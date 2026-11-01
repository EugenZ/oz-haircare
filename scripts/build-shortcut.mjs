// Builds the "OZ SMS" Apple Shortcut («Команды») that drains the SMS outbox:
// POST /api/outbox/claim -> for each item: Send Message -> POST item.ackUrl.
// The OUTBOX_API_TOKEN is never embedded: iOS asks for it on import.
//
//   node scripts/build-shortcut.mjs [baseUrl] [outDir]
//
// Writes <outDir>/OZ-SMS.unsigned.shortcut and, via `shortcuts sign`,
// <outDir>/OZ-SMS.shortcut (macOS only).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = (process.argv[2] ?? "https://oz-haircare.com").replace(/\/+$/, "");
const outDir = process.argv[3] ?? path.join(os.homedir(), "oz-haircare-shortcuts");

const ids = {
  token: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1001",
  claim: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1002",
  items: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1003",
  phone: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1004",
  text: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1005",
  claimId: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1006",
  ackUrl: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1007",
  send: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1008",
  ack: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B1009",
  loop: "6B1C4E1A-0D52-4F4B-9C11-0A7E5D2B100A",
};
const OBJ = "\uFFFC"; // placeholder char that a variable attachment replaces

const output = (uuid, name) => ({ OutputUUID: uuid, Type: "ActionOutput", OutputName: name });
const attachment = (value) => ({ Value: value, WFSerializationType: "WFTextTokenAttachment" });
const repeatItem = attachment({ Type: "Variable", VariableName: "Repeat Item" });

// Text with variables: parts are strings or output refs.
function tokenString(...parts) {
  let string = "";
  const attachmentsByRange = {};
  for (const part of parts) {
    if (typeof part === "string") string += part;
    else {
      attachmentsByRange[`{${string.length}, 1}`] = part;
      string += OBJ;
    }
  }
  const value = Object.keys(attachmentsByRange).length ? { string, attachmentsByRange } : { string };
  return { Value: value, WFSerializationType: "WFTextTokenString" };
}

// WFItemType: 0 text, 3 number.
function dictionary(entries) {
  return {
    Value: {
      WFDictionaryFieldValueItems: entries.map(([key, value, type = 0]) => ({
        WFItemType: type,
        WFKey: tokenString(key),
        WFValue: Array.isArray(value) ? tokenString(...value) : tokenString(value),
      })),
    },
    WFSerializationType: "WFDictionaryFieldValue",
  };
}

const authHeaders = () =>
  dictionary([
    ["Authorization", ["Bearer ", output(ids.token, "Text")]],
    ["Content-Type", "application/json"],
  ]);

const getValue = (uuid, key, input) => ({
  WFWorkflowActionIdentifier: "is.workflow.actions.getvalueforkey",
  WFWorkflowActionParameters: {
    UUID: uuid,
    WFGetDictionaryValueType: "Value",
    WFDictionaryKey: key,
    WFInput: input,
  },
});

const actions = [
  {
    WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
    WFWorkflowActionParameters: { UUID: ids.token, WFTextActionText: "" },
  },
  {
    WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
    WFWorkflowActionParameters: {
      UUID: ids.claim,
      WFURL: `${baseUrl}/api/outbox/claim`,
      WFHTTPMethod: "POST",
      ShowHeaders: true,
      WFHTTPHeaders: authHeaders(),
      WFHTTPBodyType: "JSON",
      WFJSONValues: dictionary([
        ["channel", "sms"],
        ["limit", "10", 3],
      ]),
    },
  },
  getValue(ids.items, "items", attachment(output(ids.claim, "Contents of URL"))),
  {
    WFWorkflowActionIdentifier: "is.workflow.actions.repeat.each",
    WFWorkflowActionParameters: {
      UUID: ids.loop,
      GroupingIdentifier: ids.loop,
      WFControlFlowMode: 0,
      WFInput: attachment(output(ids.items, "Dictionary Value")),
    },
  },
  getValue(ids.phone, "phone", repeatItem),
  getValue(ids.text, "text", repeatItem),
  getValue(ids.claimId, "claim", repeatItem),
  getValue(ids.ackUrl, "ackUrl", repeatItem),
  {
    WFWorkflowActionIdentifier: "is.workflow.actions.sendmessage",
    WFWorkflowActionParameters: {
      UUID: ids.send,
      ShowWhenRun: false,
      WFSendMessageActionRecipients: attachment(output(ids.phone, "Dictionary Value")),
      WFSendMessageContent: tokenString(output(ids.text, "Dictionary Value")),
    },
  },
  {
    WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
    WFWorkflowActionParameters: {
      UUID: ids.ack,
      WFURL: tokenString(output(ids.ackUrl, "Dictionary Value")),
      WFHTTPMethod: "POST",
      ShowHeaders: true,
      WFHTTPHeaders: authHeaders(),
      WFHTTPBodyType: "JSON",
      WFJSONValues: dictionary([
        ["claim", [output(ids.claimId, "Dictionary Value")]],
        ["result", "sent"],
      ]),
    },
  },
  {
    WFWorkflowActionIdentifier: "is.workflow.actions.repeat.each",
    WFWorkflowActionParameters: { GroupingIdentifier: ids.loop, WFControlFlowMode: 2 },
  },
];

const workflow = {
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: "900",
  WFWorkflowClientVersion: "2607.0.2",
  WFWorkflowIcon: { WFWorkflowIconStartColor: 4292093695, WFWorkflowIconGlyphNumber: 59446 },
  WFWorkflowTypes: [],
  WFWorkflowInputContentItemClasses: [],
  WFWorkflowOutputContentItemClasses: [],
  WFWorkflowHasOutputFallback: false,
  WFWorkflowHasShortcutInputVariables: false,
  WFWorkflowImportQuestions: [
    {
      ActionIndex: 0,
      Category: "Parameter",
      ParameterKey: "WFTextActionText",
      DefaultValue: "",
      Text: "Вставьте OUTBOX_API_TOKEN (токен для очереди SMS)",
    },
  ],
  WFWorkflowActions: actions,
};

fs.mkdirSync(outDir, { recursive: true });
const json = path.join(outDir, "OZ-SMS.json");
const unsigned = path.join(outDir, "OZ-SMS.unsigned.shortcut");
const signed = path.join(outDir, "OZ-SMS.shortcut");
fs.writeFileSync(json, JSON.stringify(workflow, null, 2));
execFileSync("plutil", ["-convert", "binary1", json, "-o", unsigned]);
execFileSync("plutil", ["-lint", unsigned], { stdio: "inherit" });
if (process.platform === "darwin") {
  execFileSync("shortcuts", ["sign", "--mode", "anyone", "--input", unsigned, "--output", signed], {
    stdio: "inherit",
  });
  console.log("signed:", signed);
}
