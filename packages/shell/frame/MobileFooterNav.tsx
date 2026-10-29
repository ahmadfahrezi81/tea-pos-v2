import { useT } from "@tea-pos/i18n/react";

import type { Tab } from "./routes";

interface MobileFooterNavProps {
    tabs: Tab[];
    currentPath: string;
    onTabClick: (path: string) => void;
}

export function MobileFooterNav({ tabs, currentPath, onTabClick }: MobileFooterNavProps) {
    const t = useT();
    return (
        <nav className="bg-white border-t border-gray-200">
            <div className="flex p-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.matchPaths.includes(currentPath);
                    return (
                        <button
                            key={tab.path}
                            onClick={() => onTabClick(tab.path)}
                            className={`flex-1 py-3 px-4 pb-2 flex flex-col items-center space-y-1 relative active:scale-[0.98] ${
                                isActive
                                    ? "text-brand bg-brand/5 rounded-2xl"
                                    : "text-gray-600 hover:text-brand"
                            }`}
                        >
                            <Icon size={26} strokeWidth={2.2} />
                            <span className="text-[11px] font-medium tracking-wide">
                                {t(tab.labelKey)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
