import type { GuidelineStatus } from "./guideline";

export interface Drug {
  id: string;
  slug: string;
  genericName: string;
  titleVi: string;
  aliases: string[];
  summary: string;
  status: GuidelineStatus;
  isPlaceholder: boolean;
}
