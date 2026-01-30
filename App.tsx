// App.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
  Alert,
  Linking,
  Switch,
} from "react-native";

/**
 * ✅ This version:
 * - Biweekly toggle is a proper Switch (Yes ↔ No)
 * - Keeps meal descriptions in the main form (for choosing)
 * - WhatsApp message is SIMPLIFIED (Mon: x2 Meat ...)
 * - Less scrolling: descriptions are collapsed by default (tap More/Less)
 * - Order Summary box (on-screen) stays detailed; WhatsApp stays simple
 *
 * IMPORTANT:
 * - Web (Netlify): put menus.json in /public/menus.json
 * - Mobile (Expo): put menus.json in /assets/menus.json
 */

type MealType = "Meat" | "Veg" | "Low Carb";
type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

type MenuItem = { name: string; description: string };
type DayMenu = { Meat?: MenuItem; Veg?: MenuItem; note?: string };
type WeeklyMenu = {
  title: string;
  dateRange?: string;
  days: Partial<Record<DayName, DayMenu>>;
};
type MenusByWeek = Record<string, WeeklyMenu>;

const DAYS: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const MEALS: MealType[] = ["Meat", "Veg", "Low Carb"];

const MEAL_COLORS: Record<MealType, string> = {
  Meat: "#ff5a5a",       // red
  Veg: "#3fd27f",        // green
  "Low Carb": "#9b6bff", // purple
};

const DAY_SHORT: Record<DayName, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
};

const PRICE_MEAT = 90;
const PRICE_VEG = 90;
const PRICE_LOW_CARB = 100;

const LOW_CARB_NOTE =
  "Low Carb meals follow the same menu as above; however, starchy sides (e.g., potatoes, rice, pasta, couscous) will be substituted with a suitable low-carb alternative such as cauliflower rice or seasonal vegetables, where appropriate.";

// ⚠️ Put your WhatsApp number here in INTERNATIONAL format, no +, no spaces.
// Example SA: 27 then number without leading 0, e.g. 27821234567
const WHATSAPP_NUMBER = "27719531885";

type QtyByDay = Record<DayName, Record<MealType, number>>;

function emptyWeekQuantities(): QtyByDay {
  return {
    Monday: { Meat: 0, Veg: 0, "Low Carb": 0 },
    Tuesday: { Meat: 0, Veg: 0, "Low Carb": 0 },
    Wednesday: { Meat: 0, Veg: 0, "Low Carb": 0 },
    Thursday: { Meat: 0, Veg: 0, "Low Carb": 0 },
    Friday: { Meat: 0, Veg: 0, "Low Carb": 0 },
  };
}

function priceFor(meal: MealType) {
  if (meal === "Meat") return PRICE_MEAT;
  if (meal === "Veg") return PRICE_VEG;
  return PRICE_LOW_CARB;
}

function formatRand(n: number) {
  return `R${n.toFixed(2)}`;
}

function sumWeekMeals(qty: QtyByDay) {
  let total = 0;
  for (const day of DAYS) for (const meal of MEALS) total += qty[day][meal] || 0;
  return total;
}

function sumWeekCost(qty: QtyByDay) {
  let total = 0;
  for (const day of DAYS) {
    for (const meal of MEALS) total += (qty[day][meal] || 0) * priceFor(meal);
  }
  return total;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function App() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const logo = require("./assets/logo.png");

  const { width } = useWindowDimensions();
  const isNarrow = width < 480;

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  // ✅ Switch-driven biweekly
  const [useWeekB, setUseWeekB] = useState(false);

  const [qtyA, setQtyA] = useState<QtyByDay>(() => emptyWeekQuantities());
  const [qtyB, setQtyB] = useState<QtyByDay>(() => emptyWeekQuantities());

  const [menusByWeek, setMenusByWeek] = useState<MenusByWeek>({});
  const [menusLoaded, setMenusLoaded] = useState(false);

  const [weekA, setWeekA] = useState<number>(1);
  const [weekB, setWeekB] = useState<number>(2);

  // ✅ Reduce scrolling: per-meal “More/Less” state (collapsed by default)
  // key format: `${which}-${weekNumber}-${day}-${meal}`
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});

  // -------- Load menus.json --------
  useEffect(() => {
    let cancelled = false;

    async function loadMenus() {
      try {
        let data: any = null;

        // web
        try {
          const res = await fetch("/menus.json");
          if (res.ok) data = await res.json();
        } catch {
          // ignore
        }

        // mobile fallback
        if (!data) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            data = require("./assets/menus.json");
          } catch {
            throw new Error(
              "menus.json not found. Put it in /public for web AND /assets for mobile."
            );
          }
        }

        if (!cancelled) {
          setMenusByWeek(data as MenusByWeek);
          setMenusLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load menus.json", err);
        if (!cancelled) {
          setMenusByWeek({});
          setMenusLoaded(true);
        }
      }
    }

    loadMenus();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableWeeks = useMemo(() => {
    return Object.keys(menusByWeek)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }, [menusByWeek]);

  const availableWeekSet = useMemo(
    () => new Set(availableWeeks),
    [availableWeeks]
  );

  // Default selected weeks from menus.json
  useEffect(() => {
    if (!menusLoaded) return;
    if (availableWeeks.length === 0) return;

    const first = availableWeeks[0];
    setWeekA(first);

    const second = availableWeeks.find((w) => w !== first) ?? first;
    setWeekB(second);

    if (availableWeeks.length < 2) setUseWeekB(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menusLoaded, availableWeeks.join(",")]);

  function getMenuForWeek(weekNumber: number): WeeklyMenu | null {
    const fromJson =
      (menusByWeek as any)?.[weekNumber] ??
      (menusByWeek as any)?.[String(weekNumber)];
    return fromJson ? (fromJson as WeeklyMenu) : null;
  }

  // Returns {name, description} (not pre-joined) to better control truncation
  function getMealParts(menu: WeeklyMenu | null, day: DayName, meal: MealType) {
    const dayMenu = menu?.days?.[day];

    if (meal === "Low Carb") {
      return { name: "Low Carb", description: LOW_CARB_NOTE };
    }

    const item = meal === "Meat" ? dayMenu?.Meat : dayMenu?.Veg;
    if (!item) return { name: "Menu item coming soon.", description: "" };

    return { name: item.name, description: item.description };
  }

  function clampWeek(n: number) {
    if (!Number.isFinite(n)) return availableWeeks[0] ?? 1;
    return Math.min(48, Math.max(1, n));
  }

  function setWeekSafely(which: "A" | "B", n: number) {
    const next = clampWeek(n);

    if (availableWeeks.length > 0 && !availableWeekSet.has(next)) {
      Alert.alert(
        "Menu not available",
        `Week ${pad2(next)} is not in menus.json.`
      );
      return;
    }

    if (which === "A") {
      if (useWeekB && next === weekB && availableWeeks.length > 1) {
        const alt = availableWeeks.find((w) => w !== next);
        if (alt != null) setWeekB(alt);
      }
      setWeekA(next);
    } else {
      if (useWeekB && next === weekA && availableWeeks.length > 1) {
        const alt = availableWeeks.find((w) => w !== next);
        if (alt != null) setWeekA(alt);
      }
      setWeekB(next);
    }
  }

  function changeQty(
    which: "A" | "B",
    day: DayName,
    meal: MealType,
    delta: number
  ) {
    const setter = which === "A" ? setQtyA : setQtyB;
    setter((prev) => {
      const next = { ...prev, [day]: { ...prev[day] } };
      const cur = next[day][meal] || 0;
      next[day][meal] = Math.max(0, cur + delta);
      return next;
    });
  }

  function clearOrder() {
    setQtyA(emptyWeekQuantities());
    setQtyB(emptyWeekQuantities());
    setNotes("");
  }

  // totals
  const weekATotalMeals = useMemo(() => sumWeekMeals(qtyA), [qtyA]);
  const weekATotalCost = useMemo(() => sumWeekCost(qtyA), [qtyA]);

  const weekBTotalMeals = useMemo(
    () => (useWeekB ? sumWeekMeals(qtyB) : 0),
    [qtyB, useWeekB]
  );
  const weekBTotalCost = useMemo(
    () => (useWeekB ? sumWeekCost(qtyB) : 0),
    [qtyB, useWeekB]
  );

  const totalMeals = weekATotalMeals + weekBTotalMeals;
  const totalCost = weekATotalCost + weekBTotalCost;

  // ---------- On-screen summary (detailed) ----------
  const hasAnySelections = totalMeals > 0;

  function buildDetailedLinesForWeek(weekNumber: number, qty: QtyByDay) {
    const menu = getMenuForWeek(weekNumber);
    const lines: string[] = [];

    lines.push(
      `Week ${pad2(weekNumber)}${menu?.dateRange ? ` (${menu.dateRange})` : ""}`
    );

    for (const day of DAYS) {
      const dayLines: string[] = [];

      for (const meal of MEALS) {
        const count = qty[day][meal] || 0;
        if (count <= 0) continue;

        const parts = getMealParts(menu, day, meal);
        // show name only to keep this readable
        const nameOnly =
          meal === "Low Carb" ? "Low Carb" : parts.name || "Menu item";
        dayLines.push(`- ${meal}: ${count} (${nameOnly})`);
      }

      if (dayLines.length > 0) {
        lines.push(`${day}`);
        lines.push(...dayLines);
      }
    }

    const cost = sumWeekCost(qty);
    const meals = sumWeekMeals(qty);
    lines.push(`Subtotal: ${meals} meals · ${formatRand(cost)}`);
    lines.push("");

    return lines;
  }

  const onScreenSummaryText = useMemo(() => {
    if (!hasAnySelections) return "";

    const lines: string[] = [];
    lines.push(`Meal Order`);
    lines.push(`Name: ${name?.trim() ? name.trim() : "[name]"}`);
    lines.push("");

    lines.push(...buildDetailedLinesForWeek(weekA, qtyA));

    if (useWeekB && weekB !== weekA) {
      lines.push(...buildDetailedLinesForWeek(weekB, qtyB));
    }

    lines.push(`TOTAL: ${totalMeals} meals · ${formatRand(totalCost)}`);

    if (notes?.trim()) {
      lines.push("");
      lines.push(`Notes: ${notes.trim()}`);
    }

    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }, [
    hasAnySelections,
    name,
    notes,
    useWeekB,
    weekA,
    weekB,
    qtyA,
    qtyB,
    totalMeals,
    totalCost,
    menusByWeek,
  ]);

  // ---------- WhatsApp summary (SIMPLIFIED) ----------
  function buildWhatsAppWeekLines(weekNumber: number, qty: QtyByDay) {
    const menu = getMenuForWeek(weekNumber);
    const lines: string[] = [];

    lines.push(
      `Week ${pad2(weekNumber)}${menu?.dateRange ? ` (${menu.dateRange})` : ""}`
    );

    for (const day of DAYS) {
      const parts: string[] = [];

      const meat = qty[day].Meat || 0;
      const veg = qty[day].Veg || 0;
      const low = qty[day]["Low Carb"] || 0;

      if (meat > 0) parts.push(`x${meat} Meat`);
      if (veg > 0) parts.push(`x${veg} Veg`);
      if (low > 0) parts.push(`x${low} Low Carb`);

      if (parts.length > 0) {
        lines.push(`${DAY_SHORT[day]}: ${parts.join(" ")}`);
      }
    }

    return lines;
  }

  const whatsappText = useMemo(() => {
    if (!hasAnySelections) return "";

    const lines: string[] = [];
    lines.push(`Meal Order`);
    lines.push(`Name: ${name?.trim() ? name.trim() : "[name]"}`);
    lines.push("");

    lines.push(...buildWhatsAppWeekLines(weekA, qtyA));

    if (useWeekB && weekB !== weekA) {
      lines.push("");
      lines.push(...buildWhatsAppWeekLines(weekB, qtyB));
    }

    lines.push("");
    lines.push(`TOTAL: ${totalMeals} meals · ${formatRand(totalCost)}`);

    if (notes?.trim()) {
      lines.push("");
      lines.push(`Notes: ${notes.trim()}`);
    }

    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }, [
    hasAnySelections,
    name,
    notes,
    useWeekB,
    weekA,
    weekB,
    qtyA,
    qtyB,
    totalMeals,
    totalCost,
    menusByWeek,
  ]);

  async function sendWhatsApp() {
    if (!hasAnySelections) {
      Alert.alert("No selections yet", "Please select at least 1 meal first.");
      return;
    }
    if (!WHATSAPP_NUMBER || WHATSAPP_NUMBER.includes("X")) {
      Alert.alert(
        "WhatsApp number not set",
        "Please set WHATSAPP_NUMBER in App.tsx (international format, no +)."
      );
      return;
    }

    // ✅ send simplified WhatsApp text (not the detailed on-screen summary)
    const encoded = encodeURIComponent(whatsappText);

    const url =
      Platform.OS === "web"
        ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`
        : `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encoded}`;

    const can = await Linking.canOpenURL(url);
    if (!can) {
      const fallback = `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
      const can2 = await Linking.canOpenURL(fallback);
      if (!can2) {
        Alert.alert("Cannot open WhatsApp", "WhatsApp is not available.");
        return;
      }
      await Linking.openURL(fallback);
      return;
    }

    await Linking.openURL(url);
  }

  // ---------- UI pieces ----------
  const WeekHeader = ({ titleWeekNumber }: { titleWeekNumber: number }) => (
    <View style={styles.weekHeaderBlock}>
      <Text style={styles.weekTitle}>Week {pad2(titleWeekNumber)}</Text>
      <Text style={styles.pricesLine}>
        Meat {formatRand(PRICE_MEAT)} · Veg {formatRand(PRICE_VEG)} · Low Carb{" "}
        {formatRand(PRICE_LOW_CARB)}
      </Text>
    </View>
  );

  const QtyStepper = ({
  which,
  day,
  meal,
  value,
}: {
  which: "A" | "B";
  day: DayName;
  meal: MealType;
  value: number;
}) => {
  const color = MEAL_COLORS[meal];

  return (
    <View style={[styles.stepperRow, isNarrow && styles.stepperRowNarrow]}>
      <Pressable
        style={[
          styles.qtyBtn,
          isNarrow && styles.qtyBtnNarrow,
          { borderColor: color, backgroundColor: `${color}22` },
        ]}
        onPress={() => changeQty(which, day, meal, -1)}
      >
        <Text style={[styles.qtyBtnText, { color }]}>−</Text>
      </Pressable>

      <Text style={[styles.qtyText, isNarrow && styles.qtyTextNarrow]}>
        {value}
      </Text>

      <Pressable
        style={[
          styles.qtyBtn,
          isNarrow && styles.qtyBtnNarrow,
          { borderColor: color, backgroundColor: `${color}22` },
        ]}
        onPress={() => changeQty(which, day, meal, +1)}
      >
        <Text style={[styles.qtyBtnText, { color }]}>+</Text>
      </Pressable>
    </View>
  );
};


  const MealRow = ({
    which,
    menu,
    weekNumber,
    day,
    meal,
    qty,
  }: {
    which: "A" | "B";
    menu: WeeklyMenu | null;
    weekNumber: number;
    day: DayName;
    meal: MealType;
    qty: number;
  }) => {
    const parts = getMealParts(menu, day, meal);
    const key = `${which}-${weekNumber}-${day}-${meal}`;
    const isExpanded = !!expandedDesc[key];

    const title =
      meal === "Low Carb" ? "Low Carb" : parts.name || "Menu item coming soon.";
    const desc = parts.description || (meal === "Low Carb" ? LOW_CARB_NOTE : "");

    // ✅ default collapsed to reduce scrolling
    const shouldShowMoreToggle = !!desc && desc.length > 80;

    return (
      <View style={[styles.itemRow, isNarrow && styles.itemRowNarrow]}>
        <View style={[styles.itemTextCol, isNarrow && styles.itemTextColNarrow]}>
          <Text style={[styles.mealLabel, { color: MEAL_COLORS[meal] }]}>
  {meal}:
</Text>


          <Text style={styles.mealName}>{title}</Text>

          {!!desc && (
            <>
              <Text
                style={styles.mealDesc}
                numberOfLines={isExpanded ? 0 : 2}
              >
                {desc}
              </Text>

              {shouldShowMoreToggle && (
                <Pressable
                  onPress={() =>
                    setExpandedDesc((prev) => ({ ...prev, [key]: !isExpanded }))
                  }
                  style={styles.moreBtn}
                >
                  <Text style={styles.moreBtnText}>
                    {isExpanded ? "Less" : "More"}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        <View style={[styles.stepperCol, isNarrow && styles.stepperColNarrow]}>
          <QtyStepper which={which} day={day} meal={meal} value={qty} />
        </View>
      </View>
    );
  };

  const DayCard = ({
    which,
    menu,
    weekNumber,
    day,
    quantities,
  }: {
    which: "A" | "B";
    menu: WeeklyMenu | null;
    weekNumber: number;
    day: DayName;
    quantities: QtyByDay;
  }) => {
    const dayTotal =
      (quantities[day].Meat || 0) +
      (quantities[day].Veg || 0) +
      (quantities[day]["Low Carb"] || 0);

    return (
      <View style={styles.dayCard}>
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayTitle}>{day}</Text>
          <View style={styles.dayPills}>
            <Text style={styles.dayPillText}>Selected: {dayTotal}</Text>
          </View>
        </View>

        <MealRow
          which={which}
          menu={menu}
          weekNumber={weekNumber}
          day={day}
          meal="Meat"
          qty={quantities[day].Meat}
        />
        <MealRow
          which={which}
          menu={menu}
          weekNumber={weekNumber}
          day={day}
          meal="Veg"
          qty={quantities[day].Veg}
        />
        <MealRow
          which={which}
          menu={menu}
          weekNumber={weekNumber}
          day={day}
          meal="Low Carb"
          qty={quantities[day]["Low Carb"]}
        />
      </View>
    );
  };

  const WeekBlock = ({
    which,
    weekNumber,
    quantities,
  }: {
    which: "A" | "B";
    weekNumber: number;
    quantities: QtyByDay;
  }) => {
    const menu = getMenuForWeek(weekNumber);

    return (
      <View style={styles.weekBlock}>
        <WeekHeader titleWeekNumber={weekNumber} />

        <View style={styles.weekMetaRow}>
          <Text style={styles.weekMetaText}>
            {menu?.title ?? "Menu"} {menu?.dateRange ? `· ${menu.dateRange}` : ""}
          </Text>
          <Text style={styles.weekMetaText}>
            Total meals: {sumWeekMeals(quantities)} · Cost:{" "}
            {formatRand(sumWeekCost(quantities))}
          </Text>
        </View>

        {DAYS.map((day) => (
          <DayCard
            key={`${which}-${weekNumber}-${day}`}
            which={which}
            menu={menu}
            weekNumber={weekNumber}
            day={day}
            quantities={quantities}
          />
        ))}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>🍽️</Text>
          </View>
          <Text style={styles.headerTitle}>MEAL ORDER FORM</Text>
        </View>

        {/* FORM CARD (NO summary here) */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="[name]"
            placeholderTextColor="#7f8a98"
            style={styles.input}
          />

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
  Select Week Number
</Text>
          <View style={styles.weekPickerRow}>
            <Text style={styles.weekPickerValue}>{pad2(weekA)}</Text>

            <View style={styles.weekPickerBtns}>
              <Pressable
                style={styles.smallBtn}
                onPress={() => setWeekSafely("A", weekA - 1)}
              >
                <Text style={styles.smallBtnText}>−</Text>
              </Pressable>
              <Pressable
                style={styles.smallBtn}
                onPress={() => setWeekSafely("A", weekA + 1)}
              >
                <Text style={styles.smallBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* ✅ SWITCH toggle (Yes ↔ No) */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Biweekly (Add Week B)</Text>
              <Text style={styles.helpText}>
                Switch ON = Biweekly order · OFF = Weekly only
              </Text>
            </View>

            <View style={styles.switchRight}>
              <Text style={styles.switchLabel}>{useWeekB ? "Yes" : "No"}</Text>
              <Switch
                value={useWeekB}
                onValueChange={setUseWeekB}
                trackColor={{ false: "#253a55", true: "#1f6b3a" }}
                thumbColor={useWeekB ? "#e9fff1" : "#f3f6fb"}
              />
            </View>
          </View>

          {useWeekB && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
  Select Week Number
</Text>

              <View style={styles.weekPickerRow}>
                <Text style={styles.weekPickerValue}>{pad2(weekB)}</Text>

                <View style={styles.weekPickerBtns}>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => setWeekSafely("B", weekB - 1)}
                  >
                    <Text style={styles.smallBtnText}>−</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => setWeekSafely("B", weekB + 1)}
                  >
                    <Text style={styles.smallBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          <Pressable style={styles.clearBtn} onPress={clearOrder}>
            <Text style={styles.clearBtnText}>Clear Order</Text>
          </Pressable>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes..."
            placeholderTextColor="#7f8a98"
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            multiline
          />

          {menusLoaded && availableWeeks.length === 0 && (
            <Text style={styles.warnText}>
              menus.json loaded but contains no week keys (e.g. "3", "4").
            </Text>
          )}
        </View>

        {/* WEEK A */}
        <WeekBlock which="A" weekNumber={weekA} quantities={qtyA} />

        {/* WEEK B */}
        {useWeekB && weekB !== weekA && (
          <WeekBlock which="B" weekNumber={weekB} quantities={qtyB} />
        )}

        {/* ✅ ORDER SUMMARY + WHATSAPP (BELOW everything) */}
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          {!hasAnySelections ? (
            <Text style={styles.summaryEmpty}>
              No meals selected yet. Choose quantities above and your order will
              appear here.
            </Text>
          ) : (
            <>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{onScreenSummaryText}</Text>
              </View>

              <View style={styles.summaryTotals}>
                <Text style={styles.totalText}>
                  Total meals: {totalMeals} · Total cost: {formatRand(totalCost)}
                </Text>
              </View>

              <View style={styles.whatsHint}>
                <Text style={styles.whatsHintText}>
                  WhatsApp message will be simplified (Mon: x2 Meat ...).
                </Text>
              </View>

              <Pressable style={styles.whatsBtn} onPress={sendWhatsApp}>
                <Text style={styles.whatsBtnText}>Send Order via WhatsApp</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.footerText}>
          {Platform.OS === "web" ? "Web version" : "Mobile version"} · Menus
          auto-load from menus.json
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 30,
    paddingHorizontal: 14,
    backgroundColor: "#0b0f14",
  },
  container: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#101826",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1d2a3a",
  },
  logoText: { fontSize: 20 },
  headerTitle: {
    color: "#f3f6fb",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: "#0f1622",
    borderWidth: 1,
    borderColor: "#182536",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  fieldLabel: {
    color: "#cfe1ff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  helpText: { color: "#9fb2c9", fontSize: 12, marginBottom: 2 },
  warnText: {
    marginTop: 10,
    color: "#ffb4b4",
    fontSize: 12,
    fontWeight: "600",
  },

  input: {
    backgroundColor: "#0b111b",
    borderWidth: 1,
    borderColor: "#1a2a3d",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f3f6fb",
    fontSize: 14,
  },

  weekPickerRow: {
    backgroundColor: "#0b111b",
    borderWidth: 1,
    borderColor: "#1a2a3d",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekPickerValue: {
    color: "#f3f6fb",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  weekPickerBtns: { flexDirection: "row", gap: 10 },
  smallBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#111b2a",
    borderWidth: 1,
    borderColor: "#20324a",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { color: "#f3f6fb", fontSize: 18, fontWeight: "900" },

  // ✅ Switch row for biweekly
  switchRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#182536",
  },
  switchRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchLabel: { color: "#f3f6fb", fontSize: 13, fontWeight: "900" },

  clearBtn: {
    marginTop: 14,
    backgroundColor: "#0b111b",
    borderWidth: 1,
    borderColor: "#22344c",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  clearBtnText: { color: "#f3f6fb", fontWeight: "800" },

  weekBlock: {
    backgroundColor: "#0f1622",
    borderWidth: 1,
    borderColor: "#182536",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  weekHeaderBlock: { marginBottom: 6 },
  weekTitle: { color: "#f3f6fb", fontSize: 18, fontWeight: "900" },
  pricesLine: {
    color: "#b8c9e6",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  weekMetaRow: { marginBottom: 10, gap: 4 },
  weekMetaText: { color: "#b8c9e6", fontSize: 12, fontWeight: "700" },

  dayCard: {
    backgroundColor: "#0b111b",
    borderWidth: 1,
    borderColor: "#1a2a3d",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  dayTitle: {
    color: "#f3f6fb",
    fontSize: 15,
    fontWeight: "900",
  },
  dayPills: {
    backgroundColor: "#101826",
    borderWidth: 1,
    borderColor: "#20324a",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dayPillText: { color: "#cfe1ff", fontWeight: "800", fontSize: 12 },

  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  itemRowNarrow: { flexDirection: "column" },

  itemTextCol: { flex: 1, minWidth: 0, paddingRight: 10 },
  itemTextColNarrow: { paddingRight: 0 },

  stepperCol: { width: 140, alignItems: "flex-end" },
  stepperColNarrow: { width: "100%", alignItems: "flex-end", marginTop: 8 },

  mealLabel: { fontWeight: "900", marginBottom: 4 },
  mealName: {
    color: "#f3f6fb",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  mealDesc: {
    color: "#d8e3f7",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  moreBtn: { marginTop: 6, alignSelf: "flex-start" },
  moreBtnText: { color: "#7fb0ff", fontWeight: "900", fontSize: 12 },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  stepperRowNarrow: { justifyContent: "flex-end" },

  qtyBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111b2a",
    borderWidth: 1,
    borderColor: "#20324a",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnNarrow: { width: 34, height: 34, borderRadius: 10 },
  qtyBtnText: { color: "#f3f6fb", fontSize: 20, fontWeight: "900" },
  qtyText: {
    minWidth: 22,
    textAlign: "center",
    color: "#f3f6fb",
    fontSize: 16,
    fontWeight: "900",
  },
  qtyTextNarrow: { fontSize: 14, minWidth: 18 },

  // --- SUMMARY (bottom) ---
  summaryBlock: {
    backgroundColor: "#0f1622",
    borderWidth: 1,
    borderColor: "#182536",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  summaryTitle: {
    color: "#f3f6fb",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  summaryEmpty: {
    color: "#b8c9e6",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  summaryBox: {
    backgroundColor: "#0b111b",
    borderWidth: 1,
    borderColor: "#1a2a3d",
    borderRadius: 14,
    padding: 12,
  },
  summaryText: {
    color: "#f3f6fb",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  summaryTotals: {
    marginTop: 10,
    backgroundColor: "#0b111b",
    borderWidth: 1,
    borderColor: "#22344c",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  totalText: { color: "#e7efff", fontWeight: "800" },

  whatsHint: {
    marginTop: 10,
    backgroundColor: "#0b111b",
    borderWidth: 1,
    borderColor: "#1a2a3d",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  whatsHintText: { color: "#b8c9e6", fontWeight: "700", fontSize: 12 },

  whatsBtn: {
    marginTop: 10,
    backgroundColor: "#0f2a1a",
    borderWidth: 1,
    borderColor: "#1f6b3a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  whatsBtnText: { color: "#f3f6fb", fontWeight: "900" },

  footerText: {
    color: "#6f7f97",
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
  },
});
