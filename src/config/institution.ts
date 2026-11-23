export type DivisionCode = "ALL" | "PRIMARY_EARLY_YEARS" | "SECONDARY";

export const INSTITUTION_CONFIG = {
  officialPlatformFullName: "UPWA International Schools Management System",
  officialShortName: "UPWA-ISMS",
  institutionalWebsiteName: "UPWA International Schools",
  tagline: "One Platform. Two Schools. Total Visibility.",
  technologyCredit: "Developed and Managed by Jojuni Technologies Limited",
  location: "University of Port Harcourt, Choba, Rivers State, Nigeria",
  divisions: {
    PRIMARY_EARLY_YEARS: {
      code: "PRIMARY_EARLY_YEARS",
      name: "Division A: Early Years & Primary",
      shortName: "Primary / Early Years",
      sections: ["Crèche", "Nursery", "Primary 1-6"],
      headTitle: "Head Teacher",
    },
    SECONDARY: {
      code: "SECONDARY",
      name: "Division B: Secondary School",
      shortName: "Secondary",
      sections: ["JSS 1-3", "SSS 1-3"],
      headTitle: "Principal",
    },
  },
} as const;
