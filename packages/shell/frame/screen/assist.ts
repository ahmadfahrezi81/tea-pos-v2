/**
 * Scroll assist (task 073), as Ionic has done since about 2016: iOS before Safari 27.3 moves its
 * whole window to show a field it focuses, outside the page and before the page hears of the
 * keyboard. So, the instant a field gets focus, the real field moves off the screen and a plain
 * copy takes its place: iOS finds nothing to move. Once the app has made room, the real field
 * comes back where the copy is.
 */

export type Field = HTMLInputElement | HTMLTextAreaElement;

export interface Assisted {
    field: Field;
    clone: Field;
    restore: () => void;
}

/** Moves `field` off the screen, `dy` px up or down, and shows a copy where it was. */
export function relocate(field: Field, dy: number, disableCopy: boolean): Assisted {
    const parent = field.parentElement!;
    const parentPosition = parent.style.position;
    // The copy is placed from the field's own parent, whatever the layout around it.
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";

    const clone = field.cloneNode(false) as Field;
    clone.value = field.value;
    for (const a of ["id", "name", "autofocus", "required"]) clone.removeAttribute(a);
    clone.tabIndex = -1;
    clone.readOnly = true;
    // Chrome on Android scrolls the page for a covered copy unless it is disabled; iOS dims it.
    clone.disabled = disableCopy;
    clone.setAttribute("aria-hidden", "true");
    clone.dataset.keyboardCopy = "";
    Object.assign(clone.style, {
        position: "absolute",
        top: `${field.offsetTop}px`,
        left: `${field.offsetLeft}px`,
        width: `${field.offsetWidth}px`,
        height: `${field.offsetHeight}px`,
        margin: "0",
        pointerEvents: "none",
        transform: "none",
    });
    parent.append(clone);

    // What is typed before the real field is back shows on the copy.
    const mirror = () => {
        clone.value = field.value;
    };
    field.addEventListener("input", mirror);
    const transform = field.style.transform;
    field.style.transform = `translate3d(-9999px, ${Math.round(dy)}px, 0) scale(0)`;
    field.dataset.keyboardAssist = "";

    return {
        field,
        clone,
        restore: () => {
            field.removeEventListener("input", mirror);
            field.style.transform = transform;
            delete field.dataset.keyboardAssist;
            clone.remove();
            parent.style.position = parentPosition;
        },
    };
}
