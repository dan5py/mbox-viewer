const globalShortcutBlockingTags = new Set([
  "A",
  "BUTTON",
  "DETAILS",
  "INPUT",
  "SELECT",
  "SUMMARY",
  "TEXTAREA",
]);
const globalShortcutBlockingRoles = [
  "button",
  "checkbox",
  "combobox",
  "link",
  "listbox",
  "menu",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
] as const;
const globalShortcutBlockingRoleSet = new Set<string>(
  globalShortcutBlockingRoles
);
const globalShortcutAllowAttribute = "data-allow-global-shortcuts";
const hasGlobalShortcutBlockingRole = (element: HTMLElement): boolean => {
  const roleAttribute = element.getAttribute("role");
  if (!roleAttribute) {
    return false;
  }

  return roleAttribute
    .split(/\s+/)
    .some((role) => globalShortcutBlockingRoleSet.has(role.toLowerCase()));
};

export const shouldIgnoreGlobalShortcutTarget = (
  target: EventTarget | null
): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  let currentElement: HTMLElement | null = target;
  while (currentElement) {
    if (currentElement.getAttribute(globalShortcutAllowAttribute) === "true") {
      return false;
    }

    if (
      currentElement.isContentEditable ||
      globalShortcutBlockingTags.has(currentElement.tagName) ||
      hasGlobalShortcutBlockingRole(currentElement)
    ) {
      return true;
    }
    currentElement = currentElement.parentElement;
  }
  return false;
};

export const isSelectionWithinElement = (
  container: HTMLElement | null
): boolean => {
  if (!container) {
    return false;
  }

  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed) {
    return false;
  }

  const getSelectionElement = (node: Node | null) =>
    node instanceof Element ? node : (node?.parentElement ?? null);
  const anchorElement = getSelectionElement(selection.anchorNode);
  const focusElement = getSelectionElement(selection.focusNode);

  return (
    (anchorElement !== null && container.contains(anchorElement)) ||
    (focusElement !== null && container.contains(focusElement))
  );
};

export const dropdownMenuFocusableItemSelector =
  '[role="menuitem"]:not([aria-disabled="true"]):not([data-disabled]):not([hidden]):not([aria-hidden="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"]):not([data-disabled]):not([hidden]):not([aria-hidden="true"]), [role="menuitemradio"]:not([aria-disabled="true"]):not([data-disabled]):not([hidden]):not([aria-hidden="true"])';
