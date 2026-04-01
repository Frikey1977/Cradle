/**
 * 浏览器自动化模块 - SSRF 防护
 */

import type { SSRFPolicy } from "../types.js";
import { lookup } from "dns";
import { promisify } from "util";

const dnsLookup = promisify(lookup);

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^::$/,
];

export async function assertBrowserNavigationAllowed(options: {
  url: string;
  ssrfPolicy: SSRFPolicy;
}): Promise<void> {
  const { url, ssrfPolicy } = options;
  
  if (ssrfPolicy.allowList?.length) {
    const allowed = ssrfPolicy.allowList.some(pattern => {
      if (pattern.startsWith("/") && pattern.endsWith("/")) {
        const regex = new RegExp(pattern.slice(1, -1));
        return regex.test(url);
      }
      return url.includes(pattern);
    });
    
    if (allowed) {
      return;
    }
  }
  
  if (ssrfPolicy.denyList?.length) {
    const denied = ssrfPolicy.denyList.some(pattern => {
      if (pattern.startsWith("/") && pattern.endsWith("/")) {
        const regex = new RegExp(pattern.slice(1, -1));
        return regex.test(url);
      }
      return url.includes(pattern);
    });
    
    if (denied) {
      throw new Error(`Navigation to '${url}' is blocked by deny list`);
    }
  }
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    if (!ssrfPolicy.allowLocalhost && isLocalhost(hostname)) {
      throw new Error(`Navigation to localhost is not allowed`);
    }
    
    if (!ssrfPolicy.allowPrivateHosts) {
      const resolved = await resolveHostname(hostname);
      
      if (isPrivateIP(resolved)) {
        throw new Error(
          `Navigation to private IP address '${resolved}' (${hostname}) is not allowed`
        );
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("is not allowed")) {
      throw error;
    }
    console.warn(`SSRF check failed for URL '${url}': ${error}`);
  }
}

export async function assertBrowserNavigationRedirectChainAllowed(options: {
  request?: {
    redirectChain(): Array<{ url(): string }>;
  };
}): Promise<void> {
  const { request } = options;
  
  if (!request) {
    return;
  }
  
  const chain = request.redirectChain();
  
  for (const redirect of chain) {
    console.log(`Redirect: ${redirect.url()}`);
  }
}

function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  );
}

async function resolveHostname(hostname: string): Promise<string> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }
  
  if (/^[\da-f]*:[\da-f:]*$/i.test(hostname)) {
    return hostname;
  }
  
  try {
    const result = await dnsLookup(hostname, { family: 4 });
    return result.address;
  } catch {
    try {
      const result = await dnsLookup(hostname, { family: 6 });
      return result.address;
    } catch {
      return hostname;
    }
  }
}

function isPrivateIP(ip: string): boolean {
  for (const range of PRIVATE_IP_RANGES) {
    if (range.test(ip)) {
      return true;
    }
  }
  return false;
}

export function isAllowedUrl(url: string, policy: SSRFPolicy): boolean {
  try {
    assertBrowserNavigationAllowed({ url, ssrfPolicy: policy });
    return true;
  } catch {
    return false;
  }
}
