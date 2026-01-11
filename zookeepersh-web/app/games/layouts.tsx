import GamesProviders from "./providers";

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <GamesProviders>{children}</GamesProviders>;
}
