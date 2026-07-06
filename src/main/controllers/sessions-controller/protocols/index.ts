import { registerBlinkerProtocol } from "./_protocols/blinker";
import { registerBlinkerInternalProtocol } from "./_protocols/blinker-internal";
import { registerBlinkerExternalProtocol } from "./_protocols/blinker-external";
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
    registerBlinkerProtocol(protocol);
  }
  if (protocols.includes("blinker-internal")) {
    registerBlinkerInternalProtocol(protocol);
  }
  if (protocols.includes("blinker-external")) {
    registerBlinkerExternalProtocol(protocol);
  }
}
