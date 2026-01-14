import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Linking,
} from "react-native";

const MEAL_PRICE = 90;

type DayKey = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
const DAYS: DayKey[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type DayOrder = {
  meat: number;
  veg: number;
};

type WeekOrder = Record<DayKey, DayOrder>;

function emptyWeek(): WeekOrder {
  return {
    Monday: { meat: 0, veg: 0 },
    Tuesday: { meat: 0, veg: 0 },
    Wednesday: { meat: 0, veg: 0 },
    Thursday: { meat: 0, veg: 0 },
    Friday: { meat: 0, veg: 0 },
  };
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(0, value - 1))}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable style={styles.stepBtn} onPress={() => onChange(value + 1)}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [name, setName] = useState("Stephanie");
  const [week, setWeek] = useState(1);
  const [order, setOrder] = useState<WeekOrder>(() => emptyWeek());
  const [vegan, setVegan] = useState(false);
  const [lowCarb, setLowCarb] = useState(false);

  function updateDay(day: DayKey, field: "meat" | "veg", value: number) {
    setOrder((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  const totals = useMemo(() => {
    let totalMeals = 0;

    DAYS.forEach((d) => {
      totalMeals += order[d].meat + order[d].veg;
    });

    return {
      totalMeals,
      totalCost: totalMeals * MEAL_PRICE,
    };
  }, [order]);

  function buildWhatsAppMessage() {
    const lines: string[] = [];
    lines.push("Evening Meal Order\n");
    lines.push(`Name: ${name}`);
    lines.push(`Week: ${String(week).padStart(2, "0")}\n`);

    DAYS.forEach((d) => {
      const day = order[d];
      const parts = [];
      if (day.meat > 0) parts.push(`x${day.meat} Meat`);
      if (day.veg > 0) parts.push(`x${day.veg} Veg`);
      lines.push(`${d}: ${parts.length ? parts.join(" ") : "-"}`);
    });

    lines.push("");
    lines.push(`Vegan: ${vegan ? "Yes" : "No"}`);
    lines.push(`Low Carb: ${lowCarb ? "Yes" : "No"}`);
    lines.push("");
    lines.push(`Total Meals: ${totals.totalMeals}`);
    lines.push(`Total Cost: R${totals.totalCost.toFixed(2)}`);

    return encodeURIComponent(lines.join("\n"));
  }

  function sendWhatsApp() {
    const message = buildWhatsAppMessage();
    const url = `https://wa.me/?text=${message}`;
    Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Evening Meal Order</Text>

        {/* Header */}
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />

          <Text style={styles.label}>Week</Text>
          <View style={styles.stepRow}>
            <Stepper value={week} onChange={setWeek} />
            <Text style={styles.weekText}>Week {String(week).padStart(2, "0")}</Text>
          </View>

          <Text style={styles.total}>Total Meals: {totals.totalMeals}</Text>
          <Text style={styles.total}>Total Cost: R{totals.totalCost.toFixed(2)}</Text>
        </View>

        {/* Days */}
        {DAYS.map((d) => (
          <View key={d} style={styles.card}>
            <Text style={styles.day}>{d}</Text>

            <View style={styles.row}>
              <Text>Meat</Text>
              <Stepper
                value={order[d].meat}
                onChange={(v) => updateDay(d, "meat", v)}
              />
            </View>

            <View style={styles.row}>
              <Text>Veg</Text>
              <Stepper
                value={order[d].veg}
                onChange={(v) => updateDay(d, "veg", v)}
              />
            </View>
          </View>
        ))}

        {/* Options */}
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text>Vegan Meal?</Text>
            <Switch value={vegan} onValueChange={setVegan} />
          </View>

          <View style={styles.switchRow}>
            <Text>Low Carb?</Text>
            <Switch value={lowCarb} onValueChange={setLowCarb} />
          </View>
        </View>

        {/* WhatsApp */}
        <Pressable style={styles.whatsappBtn} onPress={sendWhatsApp}>
          <Text style={styles.whatsappText}>SEND ORDER VIA WHATSAPP</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#111" },
  container: { padding: 16 },
  title: { color: "white", fontSize: 22, fontWeight: "700", marginBottom: 10 },
  card: {
    backgroundColor: "#1b1b1b",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  label: { color: "#ccc", marginTop: 6 },
  input: {
    backgroundColor: "#333",
    color: "white",
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  total: { color: "white", fontWeight: "700", marginTop: 4 },
  day: { color: "white", fontWeight: "700", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  stepper: { flexDirection: "row", alignItems: "center" },
  stepBtn: {
    width: 32,
    height: 32,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  stepText: { color: "white", fontSize: 18 },
  stepValue: { color: "white", width: 30, textAlign: "center" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  weekText: { color: "white" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  whatsappBtn: {
    backgroundColor: "#25D366",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  whatsappText: { color: "white", fontWeight: "700" },
});
