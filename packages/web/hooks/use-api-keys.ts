"use client";

import { useState, useEffect, useCallback } from "react";
import { withBasePath } from "@/lib/base-path";

interface EnvStatus {
  BRIGHT_DATA_API_KEY: boolean;
  BRIGHT_DATA_SERP_ZONE: boolean;
  BRIGHT_DATA_UNLOCKER_ZONE: boolean;
  OPENROUTER_API_KEY: boolean;
}

export function useApiKeys() {
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkEnv = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch(withBasePath("/api/check-env"));
      if (res.ok) {
        const data = await res.json();
        setEnvStatus(data);
      }
    } catch {
      // Server may not be ready yet
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkEnv();
  }, [checkEnv]);

  const hasAllKeys = envStatus
    ? envStatus.BRIGHT_DATA_API_KEY && envStatus.OPENROUTER_API_KEY
    : false;

  return { envStatus, hasAllKeys, isChecking, checkEnv };
}
