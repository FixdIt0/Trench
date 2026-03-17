import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import App from "./App";

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "#000";

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
  walletList: ["phantom"],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider
      appId="cmmumbv0a04gi0cjyyxgzfaup"
      config={{
        appearance: {
          walletChainType: "solana-only",
          theme: "dark",
          accentColor: "#c8a84e",
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        loginMethods: ["email", "wallet"],
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>
);
