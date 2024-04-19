/* eslint-disable security/detect-object-injection */
/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */

import { Draft, produce } from "immer";
import {
    CANVAS_ID,
    CanvasMetadata,
} from "@/components/pixi/canvas/hooks/useCanvasContext";
import { LABEL_MAP } from "@/lib/utils/const";
import { MarkingNotFoundError } from "@/lib/errors/custom-errors/MarkingNotFoundError";
import { showErrorDialog } from "@/lib/errors/showErrorDialog";
import { getOppositeCanvasId } from "@/components/pixi/canvas/utils/get-opposite-canvas-id";
import { ActionProduceCallback } from "../immer.helpers";
import {
    InternalMarking,
    Marking,
    MarkingsState as State,
    _createMarkingsStore as createStore,
} from "./Markings.store";
import { GlobalStateStore } from "../GlobalState";

const useLeftStore = createStore(CANVAS_ID.LEFT);
const useRightStore = createStore(CANVAS_ID.RIGHT);

function* labelGenerator(): Generator<string> {
    let index = 0;
    while (true) {
        const offset =
            (yield LABEL_MAP[index] ?? String(index - LABEL_MAP.length + 1)) ===
            "prev"
                ? -1
                : 1;
        index += offset;
    }
}

const labelGen = labelGenerator();

const { setLastAddedMarking } = GlobalStateStore.actions.lastAddedMarking;

class StoreClass {
    readonly id: CANVAS_ID;

    readonly use: typeof useLeftStore;

    constructor(id: CanvasMetadata["id"]) {
        this.id = id;
        this.use = id === CANVAS_ID.LEFT ? useLeftStore : useRightStore;
    }

    get state() {
        return this.use.getState();
    }

    private setCursor(callback: ActionProduceCallback<State["cursor"], State>) {
        this.state.set(draft => {
            draft.cursor = callback(draft.cursor, draft);
        });
    }

    private setMarkingsHash(
        callback: ActionProduceCallback<State["markingsHash"], State>
    ) {
        this.state.set(draft => {
            draft.markingsHash = callback(draft.markingsHash, draft);
        });
    }

    private setMarkings(
        callback: ActionProduceCallback<State["markings"], State>
    ) {
        this.state.set(draft => {
            const newMarkings = callback(draft.markings, draft);
            draft.markings = newMarkings;

            const lastMarking = newMarkings.at(-1);
            if (lastMarking !== undefined)
                setLastAddedMarking({ ...lastMarking, canvasId: this.id });
        });
    }

    private setMarkingsAndUpdateHash(
        callback: ActionProduceCallback<State["markings"], State>
    ) {
        this.setMarkingsHash(() => crypto.randomUUID());
        this.setMarkings(callback);
    }

    private setTemporaryMarking(
        callback: ActionProduceCallback<State["temporaryMarking"], State>
    ) {
        this.state.set(draft => {
            draft.temporaryMarking = callback(draft.temporaryMarking, draft);
        });
    }

    readonly actions = {
        cursor: {
            updateCursor: (
                rowIndex: number,
                id?: InternalMarking["id"],
                boundMarkingId?: InternalMarking["boundMarkingId"]
            ) => {
                this.setCursor(() => ({
                    rowIndex,
                    ...(id && { id }),
                    ...(boundMarkingId && { boundMarkingId }),
                }));
            },
            isFinite: () => {
                return Number.isFinite(this.state.cursor.rowIndex);
            },
            getMarkingAtCursor: () => {
                return (
                    this.state.markings.find(
                        m => m.id === this.state.cursor.id
                    ) ??
                    this.state.markings.find(
                        m =>
                            m.boundMarkingId ===
                            this.state.cursor.boundMarkingId
                    )
                );
            },
        },
        table: {
            setTableRows: (rows: State["tableRows"]) => {
                this.state.set(draft => {
                    draft.tableRows = rows;
                });
            },
        },
        markings: {
            reset: () => {
                this.state.reset();
            },
            addOne: (marking: Marking) => {
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        state.push(getInferredMarking(this.id, marking));
                    })
                );
            },
            addMany: (markings: Marking[]) => {
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        state.push(
                            ...markings.map(m => getInferredMarking(this.id, m))
                        );
                    })
                );
            },
            removeOneById: (id: string) => {
                this.setMarkingsAndUpdateHash(state => {
                    return state.filter(marking => marking.id !== id);
                });
            },
            removeManyById: (ids: string[]) => {
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        return state.filter(
                            marking => !ids.includes(marking.id)
                        );
                    })
                );
            },
            editOneById: (id: string, newMarking: Partial<Marking>) => {
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        try {
                            const index = state.findIndex(m => m.id === id);
                            if (index === -1) throw new MarkingNotFoundError();

                            Object.assign(state[index]!, newMarking);
                        } catch (error) {
                            showErrorDialog(error);
                        }
                    })
                );
            },
            bindOneById: (id: string, boundMarkingId: string) => {
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        try {
                            const index = state.findIndex(m => m.id === id);
                            if (index === -1) throw new MarkingNotFoundError();

                            Object.assign(state[index]!, { boundMarkingId });
                        } catch (error) {
                            showErrorDialog(error);
                        }
                    })
                );
            },
            selectOneById: (
                id: string,
                callback: (
                    oldSelected: Marking["selected"]
                ) => Marking["selected"]
            ) => {
                this.setMarkingsAndUpdateHash(
                    produce(state => {
                        try {
                            const index = state.findIndex(m => m.id === id);
                            if (index === -1) throw new MarkingNotFoundError();

                            state[index]!.selected = callback(
                                state[index]!.selected
                            );
                        } catch (error) {
                            showErrorDialog(error);
                        }
                    })
                );
            },
        },
        temporaryMarking: {
            setTemporaryMarking: (
                marking: Marking | null,
                label?: InternalMarking["label"]
            ) => {
                if (marking === null) {
                    this.setTemporaryMarking(() => null);
                    return;
                }
                this.setTemporaryMarking(() => ({
                    id: "\0",
                    label: label ?? "\0",
                    ...marking,
                }));
            },
            updateTemporaryMarking: (props: Partial<Marking>) => {
                this.setTemporaryMarking(
                    produce(state => {
                        if (state !== null) {
                            Object.assign(state, props);
                        }
                    })
                );
            },
        },
    };
}

const LeftStore = new StoreClass(CANVAS_ID.LEFT);
const RightStore = new StoreClass(CANVAS_ID.RIGHT);

export const Store = (id: CanvasMetadata["id"]) => {
    switch (id) {
        case CANVAS_ID.LEFT:
            return LeftStore;
        case CANVAS_ID.RIGHT:
            return RightStore;
        default:
            throw new Error(id satisfies never);
    }
};

// funkcja która nadaje id, label oraz id powiązanego markinga dla nowego markingu
function getInferredMarking(
    canvasId: CANVAS_ID,
    marking: Marking
): InternalMarking {
    return produce(marking, (draft: Draft<InternalMarking>) => {
        draft.id = crypto.randomUUID();

        if (draft.label !== undefined) {
            // Przypadek gdy ostatnio dodany marking ma już przypisany label
            // (Najczęściej jest to sytuacja gdy wgrywamy plik z danymi markingu)
            // Znajdź czy istnieje znacznik z takim samym labelem w przeciwnym canvasie
            // Jeśli tak to przypisz go do tego markingu i powiąż je
            const oppositeCanvasId = getOppositeCanvasId(canvasId);
            const boundMarking = Store(oppositeCanvasId).state.markings.find(
                e => e.label === draft.label
            );

            if (boundMarking === undefined) {
                draft.label = labelGen.next().value;
                return;
            }
            Store(oppositeCanvasId).actions.markings.bindOneById(
                boundMarking.id,
                draft.id
            );
            draft.boundMarkingId = boundMarking.id;
            draft.label = boundMarking.label;
            return;
        }

        const { lastAddedMarking } = GlobalStateStore.state;
        const isLastAddedMarkingInOppositeCanvas =
            lastAddedMarking !== null && lastAddedMarking.canvasId !== canvasId;

        if (isLastAddedMarkingInOppositeCanvas) {
            // Przypadek gdy ostatnio dodany marking jest z przeciwnego canvasa
            // Weź znacznik z ostatnio dodanego markingu i powiąż go z tym markingiem

            const isLabelAlreadyUsed =
                Store(canvasId).state.markings.findLastIndex(
                    m => m.label === lastAddedMarking.label
                ) !== -1;

            draft.label = isLabelAlreadyUsed
                ? labelGen.next().value
                : lastAddedMarking.label;

            if (lastAddedMarking.label === draft.label) {
                draft.boundMarkingId = lastAddedMarking.id;
                Store(lastAddedMarking.canvasId).actions.markings.bindOneById(
                    lastAddedMarking.id,
                    draft.id
                );
            }

            return;
        }

        // Przypadek gdy ostatnio dodany marking jest z tego samego canvasa
        // Po prostu wygeneruj nowy znacznik
        draft.label = labelGen.next().value;
    }) as InternalMarking;
}

export { Store as MarkingsStore };
export { StoreClass as MarkingsStoreClass };
