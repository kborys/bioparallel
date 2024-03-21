"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { InternalMarking } from "@/lib/stores/Markings";

export type ExtendedMarking = InternalMarking & {
    x: number;
    y: number;
};

export const columns: ColumnDef<ExtendedMarking>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={value =>
                    table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={value => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "label",
        header: "Label",
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const marking = row.original;
            return (
                marking.type.slice(0, 1).toUpperCase() + marking.type.slice(1)
            );
        },
    },
];
