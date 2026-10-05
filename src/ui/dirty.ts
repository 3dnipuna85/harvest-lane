/** Set when the seed bar, tabs and panel need a full re-render rather than a value update. */
let dirty = true;
export const markDirty = () => { dirty = true; };
export const takeDirty = () => { const d = dirty; dirty = false; return d; };
