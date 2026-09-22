import { SettingsTabs } from "./settings-tabs";

// Tabs only — every settings page and action still calls requireAdmin() itself.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsTabs />
      {children}
    </>
  );
}
