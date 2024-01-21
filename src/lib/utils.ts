import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type Prettify<T> = {
    [K in keyof T]: T[K];
    // eslint-disable-next-line @typescript-eslint/ban-types
} & {};

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
