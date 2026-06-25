import { registerFlowProtocol } from "./_protocols/blinker";
import { registerFlowInternalProtocol } from "./_protocols/blinker-internal";
import { registerFlowExternalProtocol } from "./_protocols/blinker-external";
import { protocol, Session } from "electron";
import type { CustomProtocol } from "./types";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "blinker",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: false,
      codeCache: true
    }
  },
  {
    scheme: "blinker-internal",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: false,
      codeCache: true
    }
  },
  {
    scheme: "blinker-external",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: false,
      allowServiceWorkers: false,
      supportFetchAPI: false,
      corsEnabled: true,
      stream: true,
      codeCache: true
    }
  }
]);

// Register protocols for normal sessions
export function registerProtocolsWithSession(session: Session, protocols: CustomProtocol[]) {
  const protocol = session.protocol;

  if (protocols.includes("blinker")) {
    registerFlowProtocol(protocol);
  }
  if (protocols.includes("blinker-internal")) {
    registerFlowInternalProtocol(protocol);
  }
  if (protocols.includes("blinker-external")) {
    registerFlowExternalProtocol(protocol);
  }
}
