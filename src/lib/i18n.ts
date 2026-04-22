import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import sq from "../locales/sq.json";

let savedLang = "en";
try { savedLang = globalThis.localStorage?.getItem("app_language") || "en"; } catch {}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sq: { translation: sq },
  },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
