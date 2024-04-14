"use client";

import { CellContext, ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { InternalMarking } from "@/lib/stores/Markings";
import { t } from "i18next";
import { IS_DEV_ENVIRONMENT } from "@/lib/utils/const";
import { GlobalStateStore } from "@/lib/stores/GlobalState";

export type ExtendedMarking = InternalMarking & {
    x: number;
    y: number;
};

export type EmptyMarking = Record<string, never>;
export type EmptyBoundMarking = { boundMarkingId: string };
export type EmptyableMarking =
    | InternalMarking
    | EmptyMarking
    | EmptyBoundMarking;
type EmptyableCellContext = CellContext<EmptyableMarking, unknown>;
type DataCellContext = CellContext<InternalMarking, unknown>;

export function isInternalMarking(
    cell: EmptyableMarking
): cell is InternalMarking {
    return "id" in cell;
}

export function isEmptyBoundMarking(
    cell: EmptyableMarking
): cell is EmptyBoundMarking {
    return !isInternalMarking(cell) && "boundMarkingId" in cell;
}

export function isEmptyMarking(cell: EmptyableMarking): cell is EmptyMarking {
    return Object.keys(cell).length === 0 && cell.constructor === Object;
}

const formatCell = <T,>(
    context: EmptyableCellContext,
    callback: (context: DataCellContext) => T,
    lastRowEmptyValue: T | string = ""
) => {
    const row = context.row.original;

    if (isInternalMarking(row)) {
        return callback(context as DataCellContext);
    }

    if (isEmptyMarking(row)) {
        return "ㅤ";
    }

    if (isEmptyBoundMarking(row) && context.column.id === "boundMarkingId") {
        return row.boundMarkingId.slice(0, 8);
    }

    if (lastRowEmptyValue === "") return lastRowEmptyValue;

    const isLastRow = context.row.index + 1 === context.table.getRowCount();
    return isLastRow ? lastRowEmptyValue : "";
};

export const getColumns: () => Array<ColumnDef<EmptyableMarking>> = () => [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={value => {
                    const newValue = !!value;
                    table.toggleAllPageRowsSelected(newValue);
                }}
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={value => {
                    const newValue = !!value;
                    row.toggleSelected(newValue);
                }}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    // ID będzie pokazane tylko podczas developmentu
    ...(IS_DEV_ENVIRONMENT
        ? ([
              {
                  accessorKey: "id",
                  header: t("Marking.Keys.id", { ns: "object" }),
                  cell: cell =>
                      formatCell(
                          cell,
                          ({ row }) =>
                              row.original.id.slice(0, 8) +
                              (isInternalMarking(row.original) &&
                              GlobalStateStore.state.lastAddedMarking?.id ===
                                  row.original.id
                                  ? " (last) "
                                  : "")
                      ),
              },
          ] as Array<ColumnDef<EmptyableMarking>>)
        : []),
    {
        accessorKey: "label",
        header: t("Marking.Keys.label", { ns: "object" }),
        cell: cell => formatCell(cell, ({ row }) => row.original.label),
    },
    // Powiązane ID będzie pokazane tylko podczas developmentu
    ...(IS_DEV_ENVIRONMENT
        ? ([
              {
                  accessorKey: "boundMarkingId",
                  header: t("Marking.Keys.boundMarkingId", { ns: "object" }),
                  cell: cell =>
                      formatCell(cell, ({ row }) =>
                          row.original.boundMarkingId?.slice(0, 8)
                      ),
              },
          ] as Array<ColumnDef<EmptyableMarking>>)
        : []),
    {
        accessorKey: "type",
        header: t("Marking.Keys.type.Name", { ns: "object" }),
        cell: cell =>
            formatCell(cell, ({ row }) => {
                const marking = row.original;

                return t(`Marking.Keys.type.Keys.${marking.type}`, {
                    ns: "object",
                });
            }),
    },
];
