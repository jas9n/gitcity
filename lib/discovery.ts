export type FeaturedOrganization = {
  owner: string;
  name: string;
  description: string;
  monogram: string;
};

export const featuredOrganizations: FeaturedOrganization[] = [
  {
    owner: "vercel",
    name: "Vercel",
    description: "Frameworks and tools for the web.",
    monogram: "VE",
  },
  {
    owner: "microsoft",
    name: "Microsoft",
    description: "Developer platforms, editors, and infrastructure.",
    monogram: "MS",
  },
  {
    owner: "google",
    name: "Google",
    description: "Open infrastructure, AI, and developer tooling.",
    monogram: "GO",
  },
  {
    owner: "facebook",
    name: "Meta",
    description: "Open source systems behind global products.",
    monogram: "ME",
  },
  {
    owner: "openai",
    name: "OpenAI",
    description: "AI research and developer tools.",
    monogram: "OA",
  },
  {
    owner: "kubernetes",
    name: "Kubernetes",
    description: "Cloud-native orchestration and its ecosystem.",
    monogram: "K8",
  },
  {
    owner: "rust-lang",
    name: "Rust",
    description: "The language, compiler, and community tooling.",
    monogram: "RS",
  },
  {
    owner: "apache",
    name: "Apache",
    description: "Foundational open source projects at global scale.",
    monogram: "AP",
  },
  {
    owner: "github",
    name: "GitHub",
    description: "Developer infrastructure and collaborative tooling.",
    monogram: "GH",
  },
  {
    owner: "apple",
    name: "Apple",
    description: "Languages, frameworks, and systems software.",
    monogram: "AL",
  },
  {
    owner: "netflix",
    name: "Netflix",
    description: "Cloud platforms and distributed systems.",
    monogram: "NF",
  },
  {
    owner: "tensorflow",
    name: "TensorFlow",
    description: "Machine learning frameworks and model tooling.",
    monogram: "TF",
  },
  {
    owner: "cloudflare",
    name: "Cloudflare",
    description: "Edge computing, networking, and security.",
    monogram: "CF",
  },
  {
    owner: "docker",
    name: "Docker",
    description: "Containers and cloud-native development.",
    monogram: "DK",
  },
  {
    owner: "hashicorp",
    name: "HashiCorp",
    description: "Infrastructure automation and cloud operations.",
    monogram: "HC",
  },
  {
    owner: "mozilla",
    name: "Mozilla",
    description: "Open web standards, browsers, and privacy.",
    monogram: "MZ",
  },
  {
    owner: "nodejs",
    name: "Node.js",
    description: "The JavaScript runtime and its ecosystem.",
    monogram: "ND",
  },
  {
    owner: "denoland",
    name: "Deno",
    description: "Modern JavaScript and TypeScript tooling.",
    monogram: "DN",
  },
  {
    owner: "supabase",
    name: "Supabase",
    description: "Open source database and backend platform.",
    monogram: "SB",
  },
  {
    owner: "elastic",
    name: "Elastic",
    description: "Search, observability, and security systems.",
    monogram: "EL",
  },
];

const cachedOwners = new Set(
  featuredOrganizations.map((item) => item.owner.toLowerCase()),
);

export function isCachedExploreTarget(owner: string) {
  return cachedOwners.has(owner.toLowerCase());
}
