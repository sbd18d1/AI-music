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
    background: "bg-base-100",
    textPrimary: "text-base-content",
    textSecondary: "text-base-content/70",
    textMuted: "text-base-content/50",
    accentColor: "bg-primary",
    accentHover: "hover:bg-primary/90",
    cardBackground: "bg-base-200",
    cardBorder: "border-base-300",
    buttonPrimary: "bg-primary",
    buttonPrimaryHover: "hover:bg-primary/90",
    buttonSecondary: "bg-secondary",
    buttonSecondaryHover: "hover:bg-secondary/90",
    buttonText: "text-white",
    inputBackground: "bg-base-200",
    inputBorder: "border-base-300",
    inputFocusBorder: "focus:border-primary",
    selectedStyle: "bg-primary",
    successColor: "text-success",
    errorColor: "text-error",
    fontSize: "text-base",
    shadow: "shadow-lg",
    shadowHover: "hover:shadow-xl",
  },
  warmRetro: {
    name: "warmRetro",
    displayName: "美式温暖复古风",
    background: "bg-base-100",
    textPrimary: "text-base-content",
    textSecondary: "text-base-content/80",
    textMuted: "text-base-content/60",
    accentColor: "bg-primary",
    accentHover: "hover:bg-primary/90",
    cardBackground: "bg-white",
    cardBorder: "border-base-content",
    buttonPrimary: "bg-secondary",
    buttonPrimaryHover: "hover:bg-warning",
    buttonSecondary: "bg-primary",
    buttonSecondaryHover: "hover:bg-primary/90",
    buttonText: "text-base-content",
    inputBackground: "bg-white",
    inputBorder: "border-base-content",
    inputFocusBorder: "focus:border-primary",
    selectedStyle: "bg-primary",
    successColor: "text-success",
    errorColor: "text-error",
    fontSize: "text-lg",
    shadow: "shadow-retro",
    shadowHover: "shadow-retro-lg",
  },
  vintageWarm: {
    name: "vintageWarm",
    displayName: "怀旧温润风",
    background: "bg-base-100",
    textPrimary: "text-base-content",
    textSecondary: "text-base-content/80",
    textMuted: "text-base-content/60",
    accentColor: "bg-primary",
    accentHover: "hover:bg-primary/90",
    cardBackground: "bg-base-200/80",
    cardBorder: "border-base-300",
    buttonPrimary: "bg-secondary",
    buttonPrimaryHover: "hover:bg-secondary/90",
    buttonSecondary: "bg-primary",
    buttonSecondaryHover: "hover:bg-primary/90",
    buttonText: "text-base-content",
    inputBackground: "bg-white",
    inputBorder: "border-base-300",
    inputFocusBorder: "focus:border-primary",
    selectedStyle: "bg-primary/10",
    successColor: "text-success",
    errorColor: "text-error",
    fontSize: "text-base",
    shadow: "shadow-vintage",
    shadowHover: "shadow-vintage-lg",
  },
  warmVintageGold: {
    name: "warmVintageGold",
    displayName: "暖色调复古金",
    background: "bg-base-100",
    textPrimary: "text-base-content",
    textSecondary: "text-base-content/80",
    textMuted: "text-base-content/60",
    accentColor: "bg-primary",
    accentHover: "hover:bg-primary/90",
    cardBackground: "bg-base-200/80",
    cardBorder: "border-base-300",
    buttonPrimary: "bg-secondary",
    buttonPrimaryHover: "hover:bg-secondary/90",
    buttonSecondary: "bg-primary",
    buttonSecondaryHover: "hover:bg-primary/90",
    buttonText: "text-base-content",
    inputBackground: "bg-white",
    inputBorder: "border-base-300",
    inputFocusBorder: "focus:border-primary",
    selectedStyle: "bg-primary/10",
    successColor: "text-success",
    errorColor: "text-error",
    fontSize: "text-base",
    shadow: "shadow-vintage",
    shadowHover: "shadow-vintage-lg",
  },
};

export function getTheme(): ThemeConfig {
  const themeName = process.env.NEXT_PUBLIC_THEME || "warmRetro";
  return themes[themeName] || themes.warmRetro;
}

export function getThemeName(): string {
  return process.env.NEXT_PUBLIC_THEME || "warmRetro";
}