import type { Metadata } from "next";
import { GitCityExperience } from "./components/GitCityExperience";

export const metadata: Metadata = {
  title: "Git/City — Repositories become a living skyline",
  description:
    "Explore GitHub repositories as an interactive 3D city shaped by code activity, stars, contributions, and language.",
};

export default function Home() {
  return <GitCityExperience />;
}
