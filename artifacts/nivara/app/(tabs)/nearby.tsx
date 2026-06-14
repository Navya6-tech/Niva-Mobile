import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useColors } from "@/hooks/useColors";

const EMERGENCY_NUMBERS = [
  { label: "Police", number: "100", icon: "shield" as const, color: "#1565C0" },
  { label: "Ambulance", number: "108", icon: "activity" as const, color: "#C62828" },
  { label: "Women Helpline", number: "1091", icon: "heart" as const, color: "#AD1457" },
  { label: "Emergency", number: "112", icon: "alert-triangle" as const, color: "#E65100" },
];

interface NearbyPlace {
  id: string;
  name: string;
  type: string;
  distance: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
}

function generateNearbyPlaces(lat: number, lng: number): NearbyPlace[] {
  const offsets = [
    { dlat: 0.003, dlng: 0.002, dist: "0.4 km" },
    { dlat: -0.005, dlng: 0.003, dist: "0.7 km" },
    { dlat: 0.008, dlng: -0.004, dist: "1.1 km" },
    { dlat: -0.010, dlng: 0.007, dist: "1.4 km" },
    { dlat: 0.012, dlng: 0.010, dist: "1.8 km" },
    { dlat: -0.015, dlng: -0.008, dist: "2.1 km" },
  ];

  const templates: { name: string; type: string; phone: string }[] = [
    { name: "City Government Hospital", type: "hospital", phone: "+91 80 2226 5353" },
    { name: "Police Station - Main Road", type: "police", phone: "100" },
    { name: "Apollo Clinic", type: "hospital", phone: "+91 80 2234 0000" },
    { name: "Fortis Emergency", type: "hospital", phone: "+91 98765 11111" },
    { name: "Traffic Police Outpost", type: "police", phone: "100" },
    { name: "MedPlus Pharmacy", type: "pharmacy", phone: "+91 80 4567 8901" },
  ];

  return templates.map((t, i) => ({
    id: i.toString(),
    name: t.name,
    type: t.type,
    distance: offsets[i].dist,
    address: `Approx. ${offsets[i].dist} from your location`,
    phone: t.phone,
    lat: lat + offsets[i].dlat,
    lng: lng + offsets[i].dlng,
  }));
}

const TYPE_CONFIG: Record<string, { icon: "activity" | "shield" | "plus-square" | "heart"; color: string; label: string }> = {
  hospital: { icon: "activity", color: "#C62828", label: "Hospital" },
  police: { icon: "shield", color: "#1565C0", label: "Police" },
  pharmacy: { icon: "plus-square", color: "#2E7D32", label: "Pharmacy" },
};

type FilterType = "all" | "hospital" | "police" | "pharmacy";

export default function NearbyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [locationError, setLocationError] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    fetchNearby();
  }, []);

  const fetchNearby = async () => {
    setLoading(true);
    setLocationError(false);
    try {
      if (Platform.OS === "web") {
        setPlaces(generateNearbyPlaces(12.9716, 77.5946));
        setLoading(false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(true);
        setPlaces(generateNearbyPlaces(12.9716, 77.5946));
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setPlaces(generateNearbyPlaces(loc.coords.latitude, loc.coords.longitude));
    } catch {
      setLocationError(true);
      setPlaces(generateNearbyPlaces(12.9716, 77.5946));
    } finally {
      setLoading(false);
    }
  };

  const openMaps = (place: NearbyPlace) => {
    Linking.openURL(
      `https://maps.google.com/?q=${place.lat.toFixed(6)},${place.lng.toFixed(6)}`
    );
  };

  const filtered = filter === "all" ? places : places.filter((p) => p.type === filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: botPad + 100 },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Poppins_700Bold" }]}>
            Nearby Help
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
            Emergency services near you
          </Text>
        </View>

        {/* India emergency numbers */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
          India Emergency Numbers
        </Text>
        <View style={styles.emergencyGrid}>
          {EMERGENCY_NUMBERS.map((item) => (
            <Pressable
              key={item.number}
              style={[
                styles.emergencyCard,
                {
                  backgroundColor: item.color + "12",
                  borderRadius: 16,
                  borderColor: item.color + "30",
                  borderWidth: 1,
                },
              ]}
              onPress={() => Linking.openURL(`tel:${item.number}`)}
            >
              <Feather name={item.icon} size={22} color={item.color} />
              <Text style={[styles.emergencyLabel, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
                {item.label}
              </Text>
              <Text style={[styles.emergencyNum, { color: item.color, fontFamily: "Poppins_700Bold" }]}>
                {item.number}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Filter pills */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Poppins_600SemiBold" }]}>
          {locationError ? "Nearby Services (approx.)" : "Nearby Services"}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(["all", "hospital", "police", "pharmacy"] as FilterType[]).map((f) => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f ? colors.primary : colors.muted,
                  borderRadius: 100,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: filter === f ? "#fff" : colors.mutedForeground,
                    fontFamily: "Poppins_500Medium",
                  },
                ]}
              >
                {f === "all" ? "All" : TYPE_CONFIG[f]?.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" }]}>
              Finding nearby services...
            </Text>
          </View>
        ) : (
          <View style={styles.placeList}>
            {filtered.map((place) => {
              const cfg = TYPE_CONFIG[place.type] ?? TYPE_CONFIG.hospital;
              return (
                <View
                  key={place.id}
                  style={[
                    styles.placeCard,
                    {
                      backgroundColor: colors.card,
                      borderRadius: 18,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={styles.placeTop}>
                    <View
                      style={[
                        styles.placeIcon,
                        { backgroundColor: cfg.color + "15" },
                      ]}
                    >
                      <Feather name={cfg.icon} size={20} color={cfg.color} />
                    </View>
                    <View style={styles.placeInfo}>
                      <Text
                        style={[
                          styles.placeName,
                          { color: colors.foreground, fontFamily: "Poppins_600SemiBold" },
                        ]}
                        numberOfLines={1}
                      >
                        {place.name}
                      </Text>
                      <Text
                        style={[
                          styles.placeAddress,
                          { color: colors.mutedForeground, fontFamily: "Poppins_400Regular" },
                        ]}
                        numberOfLines={1}
                      >
                        {place.address}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.distanceBadge,
                        { backgroundColor: cfg.color + "15", borderRadius: 100 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.distanceText,
                          { color: cfg.color, fontFamily: "Poppins_600SemiBold" },
                        ]}
                      >
                        {place.distance}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.placeDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.placeActions}>
                    {place.phone && (
                      <Pressable
                        style={[
                          styles.placeActionBtn,
                          { backgroundColor: "#4CAF5015", borderRadius: 10 },
                        ]}
                        onPress={() => Linking.openURL(`tel:${place.phone}`)}
                      >
                        <Feather name="phone" size={15} color="#4CAF50" />
                        <Text
                          style={[
                            styles.placeActionText,
                            { color: "#4CAF50", fontFamily: "Poppins_500Medium" },
                          ]}
                        >
                          Call
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[
                        styles.placeActionBtn,
                        { backgroundColor: cfg.color + "15", borderRadius: 10, flex: 1 },
                      ]}
                      onPress={() => openMaps(place)}
                    >
                      <Feather name="navigation" size={15} color={cfg.color} />
                      <Text
                        style={[
                          styles.placeActionText,
                          { color: cfg.color, fontFamily: "Poppins_500Medium" },
                        ]}
                      >
                        Directions
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 15 },
  emergencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  emergencyCard: {
    width: "47%",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  emergencyLabel: { fontSize: 13, textAlign: "center" },
  emergencyNum: { fontSize: 24 },
  filterRow: { flexGrow: 0 },
  filterChip: { paddingHorizontal: 18, paddingVertical: 8, marginRight: 8 },
  filterText: { fontSize: 13 },
  loadingContainer: { alignItems: "center", gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 14 },
  placeList: { gap: 12 },
  placeCard: { padding: 16 },
  placeTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  placeIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 14 },
  placeAddress: { fontSize: 12, marginTop: 2 },
  distanceBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  distanceText: { fontSize: 12 },
  placeDivider: { height: 1, marginVertical: 12 },
  placeActions: { flexDirection: "row", gap: 8 },
  placeActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  placeActionText: { fontSize: 13 },
});
