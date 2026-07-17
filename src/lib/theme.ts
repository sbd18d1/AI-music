export interface ThemeConfig {
  name: string;
  displayName: string;
  background: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentColor: string;
  accentHover: string;
  cardBackground: string;
  cardBorder: string;
  buttonPrimary: string;
  buttonPrimaryHover: string;
  buttonSecondary: string;
  buttonSecondaryHover: string;
  buttonText: string;
  inputBackground: string;
  inputBorder: string;
  inputFocusBorder: string;
  selectedStyle: string;
  successColor: string;
  errorColor: string;
  fontSize: string;
  shadow: string;
  shadowHover: string;
}

export const themes: Record<string, ThemeConfig> = {
  modern: {
    name: "modern",
    displayName: "现代深色风",
    background: "bg-gray-900",
    textPrimary: "text-white",
    textSecondary: "text-gray-300",
    textMuted: "text-gray-500",
    accentColor: "bg-indigo-600",
    accentHover: "hover:bg-indigo-700",
    cardBackground: "bg-gray-800",
    cardBorder: "border-gray-700",
    buttonPrimary: "bg-indigo-600",
    buttonPrimaryHover: "hover:bg-indigo-700",
    buttonSecondary: "bg-gray-700",
    buttonSecondaryHover: "hover:bg-gray-600",
    buttonText: "text-white",
    inputBackground: "bg-gray-800",
    inputBorder: "border-gray-600",
    inputFocusBorder: "focus:border-indigo-500",
    selectedStyle: "bg-indigo-600",
    successColor: "text-green-500",
    errorColor: "text-red-500",
    fontSize: "text-base",
    shadow: "shadow-lg",
    shadowHover: "hover:shadow-xl",
  },
  warmRetro: {
    name: "warmRetro",
    displayName: "美式温暖复古风",
    background: "bg-warm-cream",
    textPrimary: "text-deep-navy",
    textSecondary: "text-deep-navy/80",
    textMuted: "text-soft-gray",
    accentColor: "bg-burgundy-wine",
    accentHover: "hover:bg-burgundy-wine/90",
    cardBackground: "bg-white",
    cardBorder: "border-deep-navy",
    buttonPrimary: "bg-paypal-gold",
    buttonPrimaryHover: "hover:bg-warm-amber",
    buttonSecondary: "bg-burgundy-wine",
    buttonSecondaryHover: "hover:bg-burgundy-wine/90",
    buttonText: "text-deep-navy",
    inputBackground: "bg-white",
    inputBorder: "border-deep-navy",
    inputFocusBorder: "focus:border-burgundy-wine",
    selectedStyle: "bg-burgundy-wine",
    successColor: "text-warm-green",
    errorColor: "text-warm-red",
    fontSize: "text-lg",
    shadow: "shadow-retro",
    shadowHover: "shadow-retro-lg",
  },
};

export function getTheme(): ThemeConfig {
  const themeName = process.env.NEXT_PUBLIC_THEME || "warmRetro";
  return themes[themeName] || themes.warmRetro;
}