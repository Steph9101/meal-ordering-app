import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Image,
  Alert,
  Linking,
  Modal,
  FlatList,
} from "react-native";

type MealType = "Meat" | "Veg" | "Low Carb";

const BASE_PRICE = 90;
const LOW_CARB_EXTRA = 10;

const MEAL_TYPES: MealType[] = ["Meat", "Veg", "Low Carb"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

const WHATSAPP_PHONE_E164 = "27719531885"; // no +, no spaces

function clamp0(n: number) {
  return n < 0 ? 0 : n;
}

function formatRand(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function emptyWeekQuantities() {
  const q: Record<(typeof DAYS)[number], Record<MealType, number>> = {} as any;
  for (const d of DAYS) q[d] = { Meat: 0, Veg: 0, "Low Carb": 0 };
  return q;
}

function sumWeekMeals(quantities: Record<(typeof DAYS)[number], Record<MealType, number>>) {
  let total = 0;
  for (const d of DAYS) for (const m of MEAL_TYPES) total += quantities[d][m];
  return total;
}

function sumWeekCost(quantities: Record<(typeof DAYS)[number], Record<MealType, number>>) {
  let total = 0;
  for (const d of DAYS) {
    for (const m of MEAL_TYPES) {
      const qty = quantities[d][m];
      const price = m === "Low Carb" ? BASE_PRICE + LOW_CARB_EXTRA : BASE_PRICE;
      total += qty * price;
    }
  }
  return total;
}

const WEEK_OPTIONS = Array.from({ length: 48 }, (_, i) => i + 1);

export default function App() {
  // IMPORTANT: file must be exactly assets/logo.png (lowercase)
  const logo = require("./assets/logo.png");

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const [weekA, setWeekA] = useState<number>(1);
  const [useWeekB, setUseWeekB] = useState(false);
  const [weekB, setWeekB] = useState<number>(2);

  const [qtyA, setQtyA] = useState(() => emptyWeekQuantities());
  const [qtyB, setQtyB] = useState(() => emptyWeekQuantities());

  // Dropdown modal state
  const [weekPickerOpen, setWeekPickerOpen] = useState<null | "A" | "B">(null);

  const weekATotalMeals = useMemo(() => sumWeekMeals(qtyA), [qtyA]);
  const weekATotalCost = useMemo(() => sumWeekCost(qtyA), [qtyA]);

  const weekBTotalMeals = useMemo(() => (useWeekB ? sumWeekMeals(qtyB) : 0), [qtyB, useWeekB]);
  const weekBTotalCost = useMemo(() => (useWeekB ? sumWeekCost(qtyB) : 0), [qtyB, useWeekB]);

  const totalMeals = weekATotalMeals + weekBTotalMeals;
  const totalCost = weekATotalCost + weekBTotalCost;

  const meatPriceLabel = `${formatRand(BASE_PRICE)}`;
  const vegPriceLabel = `${formatRand(BASE_PRICE)}`;
  const lowCarbPriceLabel = `${formatRand(BASE_PRICE + LOW_CARB_EXTRA)}`;

  const changeQty = (
    which: "A" | "B",
    day: (typeof DAYS)[number],
    meal: MealType,
    delta: number
  ) => {
    const setter = which === "A" ? setQtyA : setQtyB;
    setter((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: clamp0(prev[day][meal] + delta),
      },
    }));
  };

  const clearOrder = () => {
    setName("");
    setNotes("");
    setWeekA(1);
    setUseWeekB(false);
    setWeekB(2);
    setQtyA(emptyWeekQuantities());
    setQtyB(emptyWeekQuantities());
    setWeekPickerOpen(null);
  };

  const buildOrderText = () => {
    const lines: string[] = [];
    lines.push("Meal Order");
    lines.push(`Name: ${name?.trim() ? name.trim() : "[name]"}`);
    lines.push("");

    lines.push(`Week ${String(weekA).padStart(2, "0")}:`);
    for (const d of DAYS) {
      const parts: string[] = [];
      for (const m of MEAL_TYPES) {
        const q = qtyA[d][m];
        if (q > 0) parts.push(`${q} ${m}`);
      }
      if (parts.length) lines.push(`- ${d}: ${parts.join(" + ")}`);
    }
    lines.push(`Total meals (Week ${String(weekA).padStart(2, "0")}): ${weekATotalMeals}`);
    lines.push(`Cost (Week ${String(weekA).padStart(2, "0")}): ${formatRand(weekATotalCost)}`);
    lines.push("");

    if (useWeekB) {
      lines.push(`Week ${String(weekB).padStart(2, "0")}:`);
      for (const d of DAYS) {
        const parts: string[] = [];
        for (const m of MEAL_TYPES) {
          const q = qtyB[d][m];
          if (q > 0) parts.push(`${q} ${m}`);
        }
        if (parts.length) lines.push(`- ${d}: ${parts.join(" + ")}`);
      }
      lines.push(`Total meals (Week ${String(weekB).padStart(2, "0")}): ${weekBTotalMeals}`);
      lines.push(`Cost (Week ${String(weekB).padStart(2, "0")}): ${formatRand(weekBTotalCost)}`);
      lines.push("");
    }

    lines.push(`Total meals: ${totalMeals}`);
    lines.push(`Total cost: ${formatRand(totalCost)}`);

    if (notes.trim()) {
      lines.push("");
      lines.push(`Notes: ${notes.trim()}`);
    }

    return lines.join("\n");
  };

  const sendWhatsApp = async () => {
    if (weekA < 1 || weekA > 48) {
      Alert.alert("Week A must be between 1 and 48.");
      return;
    }
    if (useWeekB) {
      if (weekB < 1 || weekB > 48) {
        Alert.alert("Week B must be between 1 and 48.");
        return;
      }
      if (weekB === weekA) {
        Alert.alert("Week B must be different from Week A.");
        return;
      }
    }

    const text = buildOrderText();
    const encoded = encodeURIComponent(text);

    const deepLink = `whatsapp://send?phone=${WHATSAPP_PHONE_E164}&text=${encoded}`;
    const webLink = `https://wa.me/${WHATSAPP_PHONE_E164}?text=${encoded}`;

    try {
      if (Platform.OS !== "web") {
        const can = await Linking.canOpenURL("whatsapp://send");
        if (can) {
          await Linking.openURL(deepLink);
          return;
        }
      }
      await Linking.openURL(webLink);
    } catch (e) {
      Alert.alert(
        "Could not open WhatsApp",
        "If WhatsApp does not open, please copy the preview text and send it manually."
      );
    }
  };

  const openWeekPicker = (which: "A" | "B") => setWeekPickerOpen(which);

  const pickWeek = (which: "A" | "B", value: number) => {
    if (which === "A") {
      if (useWeekB && value === weekB) {
        Alert.alert("Not allowed", "Week A cannot be the same as Week B.");
        return;
      }
      setWeekA(value);
    } else {
      if (value === weekA) {
        Alert.alert("Not allowed", "Week B cannot be the same as Week A.");
        return;
      }
      setWeekB(value);
    }
    setWeekPickerOpen(null);
  };

  const WeekPickerModal = () => {
    if (!weekPickerOpen) return null;
    const which = weekPickerOpen;
    const selected = which === "A" ? weekA : weekB;
    const other = which === "A" ? weekB : weekA;
    const otherEnabled = which === "A" ? useWeekB : true;

    return (
      <Modal transparent animationType="fade" visible onRequestClose={() => setWeekPickerOpen(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setWeekPickerOpen(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {which === "A" ? "Select Week A (1–48)" : "Select Week B (1–48)"}
            </Text>

            <FlatList
              data={WEEK_OPTIONS}
              keyExtractor={(n) => String(n)}
              showsVerticalScrollIndicator
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => {
                const disabled = otherEnabled && item === other;
                const isSelected = item === selected;
                return (
                  <Pressable
                    onPress={() => !disabled && pickWeek(which, item)}
                    style={[
                      styles.modalItem,
                      isSelected && styles.modalItemSelected,
                      disabled && styles.modalItemDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        isSelected && styles.modalItemTextSelected,
                        disabled && styles.modalItemTextDisabled,
                      ]}
                    >
                      {String(item).padStart(2, "0")}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Pressable style={styles.modalCloseBtn} onPress={() => setWeekPickerOpen(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const WeekHeader = ({ titleWeekNumber }: { titleWeekNumber: number }) => (
    <View style={styles.weekHeaderBlock}>
      <Text style={styles.weekTitle}>Week {String(titleWeekNumber).padStart(2, "0")}</Text>
      <Text style={styles.mealHeaderRow}>
        Meat {meatPriceLabel}   Veg {vegPriceLabel}   Low Carb {lowCarbPriceLabel}
      </Text>
    </View>
  );

  const WeekBlock = ({
    which,
    weekNumber,
    quantities,
    weekMeals,
    weekCost,
  }: {
    which: "A" | "B";
    weekNumber: number;
    quantities: Record<(typeof DAYS)[number], Record<MealType, number>>;
    weekMeals: number;
    weekCost: number;
  }) => {
    return (
      <View style={styles.weekCard}>
        <WeekHeader titleWeekNumber={weekNumber} />
        <Text style={styles.weekSub}>
          Total meals: {weekMeals} • Cost: {formatRand(weekCost)}
        </Text>

        {DAYS.map((d) => (
          <View key={d} style={styles.dayLine}>
            <Text style={styles.dayName}>{d}</Text>

            {/* Meat */}
            <View style={styles.inlineCounter}>
              <Text style={styles.inlineLabel}>Meat</Text>
              <View style={styles.inlineControls}>
                <Pressable style={styles.btn} onPress={() => changeQty(which, d, "Meat", -1)}>
                  <Text style={styles.btnText}>−</Text>
                </Pressable>
                <Text style={styles.value}>{quantities[d]["Meat"]}</Text>
                <Pressable style={styles.btn} onPress={() => changeQty(which, d, "Meat", +1)}>
                  <Text style={styles.btnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Veg */}
            <View style={styles.inlineCounter}>
              <Text style={styles.inlineLabel}>Veg</Text>
              <View style={styles.inlineControls}>
                <Pressable style={styles.btn} onPress={() => changeQty(which, d, "Veg", -1)}>
                  <Text style={styles.btnText}>−</Text>
                </Pressable>
                <Text style={styles.value}>{quantities[d]["Veg"]}</Text>
                <Pressable style={styles.btn} onPress={() => changeQty(which, d, "Veg", +1)}>
                  <Text style={styles.btnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Low Carb */}
            <View style={styles.inlineCounter}>
              <Text style={styles.inlineLabel}>Low Carb</Text>
              <View style={styles.inlineControls}>
                <Pressable style={styles.btn} onPress={() => changeQty(which, d, "Low Carb", -1)}>
                  <Text style={styles.btnText}>−</Text>
                </Pressable>
                <Text style={styles.value}>{quantities[d]["Low Carb"]}</Text>
                <Pressable style={styles.btn} onPress={() => changeQty(which, d, "Low Carb", +1)}>
                  <Text style={styles.btnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <WeekPickerModal />

        {/* Header */}
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.headerTitle}>MEAL ORDER FORM</Text>
        </View>

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="[name]"
            placeholderTextColor="#9aa3ad"
            style={styles.input}
          />
        </View>

        {/* Week selection */}
        <View style={styles.card}>
          <Text style={styles.label}>Select Week A (1–48)</Text>
          <Pressable style={styles.dropdownBtn} onPress={() => openWeekPicker("A")}>
            <Text style={styles.dropdownText}>{String(weekA).padStart(2, "0")}</Text>
            <Text style={styles.dropdownChevron}>▾</Text>
          </Pressable>

          {/* Add Week B block (with Yes/No inside the block) */}
          <View style={styles.instructionsBox}>
            <View style={styles.instructionsHeaderRow}>
              <Text style={styles.instructionsTitle}>Add Week B</Text>

              <Pressable
                onPress={() => setUseWeekB((v) => !v)}
                style={[
                  styles.toggleBtn,
                  useWeekB ? styles.toggleBtnOn : styles.toggleBtnOff,
                  styles.toggleBtnInHeader,
                ]}
              >
                <Text style={styles.toggleText}>{useWeekB ? "Yes" : "No"}</Text>
              </Pressable>
            </View>

            <Text style={styles.instructionsText}>Select “Yes” for a Biweekly Order</Text>
            <Text style={styles.instructionsText}>Select “No” for a Weekly Order Only</Text>
          </View>

          {useWeekB && (
            <>
              <Text style={[styles.label, { marginTop: 6 }]}>Select Week B (1–48)</Text>
              <Pressable style={styles.dropdownBtn} onPress={() => openWeekPicker("B")}>
                <Text style={styles.dropdownText}>{String(weekB).padStart(2, "0")}</Text>
                <Text style={styles.dropdownChevron}>▾</Text>
              </Pressable>
            </>
          )}

          {/* Removed Total Meals / Total Cost boxes here (as per image) */}

          <Pressable onPress={clearOrder} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear Order</Text>
          </Pressable>
        </View>

        {/* Weeks */}
        <WeekBlock
          which="A"
          weekNumber={weekA}
          quantities={qtyA}
          weekMeals={weekATotalMeals}
          weekCost={weekATotalCost}
        />

        {useWeekB && (
          <WeekBlock
            which="B"
            weekNumber={weekB}
            quantities={qtyB}
            weekMeals={weekBTotalMeals}
            weekCost={weekBTotalCost}
          />
        )}

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Example: no alcohol in food, replace pork with chicken"
            placeholderTextColor="#9aa3ad"
            style={[styles.input, styles.notes]}
            multiline
          />
        </View>

        {/* WhatsApp + Preview */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Send order via WhatsApp</Text>

          <Pressable onPress={sendWhatsApp} style={styles.whatsappBtn}>
            <Text style={styles.whatsappBtnText}>SEND MY MEAL ON WHATSAPP</Text>
          </Pressable>

          <Text style={styles.smallHint}>
            This will open WhatsApp and send the order to +{WHATSAPP_PHONE_E164}
          </Text>

          <View style={styles.totalsRow}>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Meals</Text>
              <Text style={styles.totalValue}>{totalMeals}</Text>
            </View>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Cost</Text>
              <Text style={styles.totalValue}>{formatRand(totalCost)}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Preview</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{buildOrderText()}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f14" },
  page: {
    padding: 14,
    gap: 12,
    maxWidth: 980,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 28,
  },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  logo: { width: 54, height: 54, borderRadius: 10 },
  headerTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },

  card: {
    backgroundColor: "#121a24",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },

  label: { color: "#cbd5e1", fontWeight: "800" },
  input: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 80, textAlignVertical: "top" },

  dropdownBtn: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: { color: "#ffffff", fontWeight: "900", fontSize: 16 },
  dropdownChevron: { color: "#ffffff", fontWeight: "900" },

  toggleBtn: {
    minWidth: 74,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleBtnInHeader: {
    marginLeft: 12,
  },
  toggleBtnOn: { backgroundColor: "#0f2a16", borderColor: "#1f7a3a" },
  toggleBtnOff: { backgroundColor: "#0b1220", borderColor: "#233044" },
  toggleText: { color: "#ffffff", fontWeight: "900" },

  instructionsBox: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  instructionsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  instructionsTitle: { color: "#ffffff", fontWeight: "900" },
  instructionsText: { color: "#b7c0cc", fontWeight: "700" },

  clearBtn: {
    marginTop: 2,
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  clearBtnText: { color: "#ffffff", fontWeight: "900" },

  weekCard: {
    backgroundColor: "#0f1621",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  weekHeaderBlock: { gap: 6 },
  weekTitle: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  mealHeaderRow: { color: "#e5e7eb", fontWeight: "900" },
  weekSub: { color: "#b7c0cc", fontWeight: "700" },

  dayLine: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  dayName: { color: "#ffffff", fontWeight: "900", fontSize: 16, marginBottom: 2 },

  inlineCounter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  inlineLabel: { color: "#cbd5e1", fontWeight: "900", width: 70 },
  inlineControls: { flexDirection: "row", alignItems: "center", gap: 10 },

  btn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderColor: "#334155",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#ffffff", fontWeight: "900", fontSize: 18 },
  value: { color: "#ffffff", fontWeight: "900", fontSize: 16, minWidth: 18, textAlign: "center" },

  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "900" },

  whatsappBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  whatsappBtnText: { color: "#ffffff", fontWeight: "900" },
  smallHint: { color: "#b7c0cc", marginTop: 8 },

  totalsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 },
  totalBox: {
    flexGrow: 1,
    minWidth: 200,
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  totalLabel: { color: "#cbd5e1", fontWeight: "800" },
  totalValue: { color: "#ffffff", fontSize: 18, fontWeight: "900", marginTop: 6 },

  previewBox: {
    marginTop: 6,
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  previewText: { color: "#e5e7eb", fontFamily: Platform.OS === "web" ? "monospace" : undefined },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 18,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#0b1220",
    borderColor: "#233044",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: "#ffffff", fontWeight: "900", fontSize: 16, marginBottom: 6 },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#233044",
    marginBottom: 8,
    backgroundColor: "#121a24",
  },
  modalItemSelected: { borderColor: "#16a34a" },
  modalItemDisabled: { opacity: 0.35 },
  modalItemText: { color: "#ffffff", fontWeight: "900" },
  modalItemTextSelected: { color: "#b9f6ca" },
  modalItemTextDisabled: { color: "#9aa3ad" },
  modalCloseBtn: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#121a24",
    borderWidth: 1,
    borderColor: "#233044",
  },
  modalCloseText: { color: "#ffffff", fontWeight: "900" },
});
