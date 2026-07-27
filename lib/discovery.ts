export type FeaturedOrganization = {
  owner: string;
  name: string;
  description: string;
  monogram: string;
};

export type FeaturedRepository = {
  fullName: `${string}/${string}`;
  name: string;
  ownerName: string;
  description: string;
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
];

export const featuredRepositories: FeaturedRepository[] = [
  {
    fullName: "facebook/react",
    name: "React",
    ownerName: "Meta",
    description: "A library for web and native user interfaces.",
  },
  {
    fullName: "microsoft/vscode",
    name: "VS Code",
    ownerName: "Microsoft",
    description: "The open source code editor.",
  },
  {
    fullName: "vercel/next.js",
    name: "Next.js",
    ownerName: "Vercel",
    description: "The React framework for the web.",
  },
  {
    fullName: "tensorflow/tensorflow",
    name: "TensorFlow",
    ownerName: "TensorFlow",
    description: "An end-to-end machine learning platform.",
  },
  {
    fullName: "rust-lang/rust",
    name: "Rust",
    ownerName: "Rust",
    description: "A language empowering reliable software.",
  },
  {
    fullName: "kubernetes/kubernetes",
    name: "Kubernetes",
    ownerName: "Kubernetes",
    description: "Production-grade container orchestration.",
  },
  {
    fullName: "denoland/deno",
    name: "Deno",
    ownerName: "Deno",
    description: "A secure JavaScript and TypeScript runtime.",
  },
  {
    fullName: "supabase/supabase",
    name: "Supabase",
    ownerName: "Supabase",
    description: "An open source development platform.",
  },
];
