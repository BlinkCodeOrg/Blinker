export async function getOpenTabsInSpace() {
  const spaceId = await blinker.spaces.getUsingSpace();
  if (!spaceId) return [];

  const tabsData = await blinker.tabs.getData();

  const tabs = tabsData.tabs.filter((tab) => tab.spaceId === spaceId);
  return tabs;
}
