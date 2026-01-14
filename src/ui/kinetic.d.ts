/**
 * Type declarations for kinetic.js module
 */

export class LissajousRenderer {
    constructor(canvas: HTMLCanvasElement);
    resize(): void;
    getPoint(curve: { a: number; b: number; delta: number; speed: number; size: number }, t: number): { x: number; y: number };
    draw(): void;
    start(): void;
    stop(): void;
}

export function initKineticBackground(isLanding?: boolean): HTMLElement | null;
export function destroyKineticBackground(): void;
export function createPendulumLoader(container: HTMLElement, pendulumCount?: number): HTMLElement;
export function createHarmonicSpinner(container: HTMLElement, dotCount?: number): HTMLElement;
export function createGearSystem(container: HTMLElement): HTMLElement;
export function createOrbitalSystem(container: HTMLElement): HTMLElement;
export function createBreathingGrid(container: HTMLElement): HTMLElement;
export function replaceLoaderWithKinetic(): void;
export function initKineticButtons(): void;
export function addKineticRipple(element: HTMLElement): void;
