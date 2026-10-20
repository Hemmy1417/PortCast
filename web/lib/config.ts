/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, verified against contracts/portcast.py; an environment override
 * points a checkout at another deployment, and the app says so on every page.
 */
export const RECORD_ADDRESS = "0xA115DbeA84FaA56527e93923670b79933065d4cE";

const override = process.env.NEXT_PUBLIC_PORTCAST_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED =
  /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS) && !/^0x0{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 = "9c33b2f659b7d58811b9a265e314d805c9ec86000cf9108638078b182bc8422d";

export const REPO_URL = "https://github.com/Hemmy1417/PortCast";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/portcast.py`;
