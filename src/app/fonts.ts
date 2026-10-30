import { Arima, Baloo_Chettan_2, Chilanka, Gayathri, Inter, Lora, Merriweather, Montserrat, Playfair_Display, Poppins, Roboto } from "next/font/google";

/* The extra faces the homepage builder's Style panel offers (lib/home-layout/theme.ts
   lists them by the same variable names). None is preloaded: a face downloads
   only when the published style actually uses it, so offering them costs every
   page a few @font-face rules and nothing more. next/font only accepts
   literal options, hence the repetition. */

const balooChettan = Baloo_Chettan_2({ subsets: ["malayalam", "latin"], display: "swap", preload: false, variable: "--font-baloo-ml" });
const gayathri = Gayathri({ subsets: ["malayalam", "latin"], display: "swap", preload: false, weight: ["400", "700"], variable: "--font-gayathri" });
const arima = Arima({ subsets: ["malayalam", "latin"], display: "swap", preload: false, variable: "--font-arima" });
const chilanka = Chilanka({ subsets: ["malayalam", "latin"], display: "swap", preload: false, weight: "400", variable: "--font-chilanka" });

const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-inter" });
const poppins = Poppins({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "600", "700"], variable: "--font-poppins" });
const roboto = Roboto({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-roboto" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-montserrat" });
const merriweather = Merriweather({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-merriweather" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-playfair" });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-lora" });

/** Class names that define every --font-* variable above; put on <body>. */
export const themeFontVariables = [balooChettan, gayathri, arima, chilanka, inter, poppins, roboto, montserrat, merriweather, playfair, lora].map((f) => f.variable).join(" ");
