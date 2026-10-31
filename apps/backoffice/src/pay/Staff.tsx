import { useT } from "@tea-pos/i18n/react";
import { SearchBox as UiSearchBox } from "@tea-pos/ui/SearchBox";
/** The search box above a staff list, as the old app's. */
export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const t = useT();
    return (
        <UiSearchBox
            value={value}
            onChange={onChange}
            placeholder={t("pay.searchStaff")}
            clearLabel={t("common.close")}
        />
    );
}
