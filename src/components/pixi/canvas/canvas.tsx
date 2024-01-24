"use client";

import { Stage } from "@pixi/react";
import { PixiApp } from "../app/app";

export type CanvasProps = Omit<Stage["props"], "children">;
export function Canvas({ options, ...props }: CanvasProps) {
    const backgroundColor = getComputedStyle(document.body).getPropertyValue(
        "--background"
    );
    const defaultOptions: typeof options = {
        background: `hsl(${backgroundColor})`,
        antialias: true,
        autoDensity: true,
        autoStart: true,
        powerPreference: "high-performance",
        resolution: 1,
        ...options,
    };

    return (
        <Stage {...props} options={defaultOptions}>
            <PixiApp width={props.width ?? 0} height={props.height ?? 0} />
        </Stage>
    );
}
