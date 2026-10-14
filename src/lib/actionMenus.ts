export function closeOtherActionMenus(openedMenu: HTMLDetailsElement) {
  if (!openedMenu.open) return;
  openedMenu.ownerDocument
    .querySelectorAll<HTMLDetailsElement>("details.activity-menu[open], details.course-menu[open]")
    .forEach(menu => {
      if (menu !== openedMenu) menu.open = false;
    });
}
