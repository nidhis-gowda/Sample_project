/**
 * Loads `.env.local` then `.env` (Next.js convention: `.env.local` wins).
 * `dotenv` never overrides variables that are already set.
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) loadEnv({ path });
}

import { connectDB, disconnectDB } from "@/lib/db/connect";
import { DepartmentModel } from "@/models/Department";
import { SkillModel } from "@/models/Skill";
import { EmployeeModel } from "@/models/Employee";
import { ProjectModel } from "@/models/Project";
import { AllocationModel } from "@/models/Allocation";
import { TrainingModel } from "@/models/Training";
import { UserModel } from "@/models/User";
import { recomputeAllWorkloads } from "@/services/workloadService";
import type { JobRole, SkillCategory } from "@/types";

/**
 * Demo data seed.
 *
 * Produces a realistic IT company: 20 employees, 25 skills, 5 departments,
 * 8 projects, live allocations and a training catalogue. Everything is created
 * through the same Mongoose models the application uses, so the seeded data is
 * indistinguishable from data created through the UI.
 *
 * Run with:  npm run seed          (safe: skips if data already exists)
 *            npm run seed:reset    (wipes the seeded collections first)
 */

const RESET = process.argv.includes("--reset");

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = [
  { name: "Engineering", code: "ENG", description: "Product and application engineering", location: "Bengaluru" },
  { name: "Platform & DevOps", code: "PLAT", description: "Infrastructure, CI/CD and reliability", location: "Hyderabad" },
  { name: "Data & Analytics", code: "DATA", description: "Data engineering, ML and reporting", location: "Pune" },
  { name: "Quality Engineering", code: "QE", description: "Test automation and quality strategy", location: "Chennai" },
  { name: "Security", code: "SEC", description: "Application and cloud security", location: "Remote" },
];

const SKILLS: Array<{ name: string; category: SkillCategory }> = [
  { name: "Python", category: "Programming" },
  { name: "Java", category: "Programming" },
  { name: "TypeScript", category: "Programming" },
  { name: "Go", category: "Programming" },
  { name: "React", category: "Frontend" },
  { name: "Next.js", category: "Frontend" },
  { name: "CSS & Design Systems", category: "Frontend" },
  { name: "Angular", category: "Frontend" },
  { name: "Node.js", category: "Backend" },
  { name: "Spring Boot", category: "Backend" },
  { name: "FastAPI", category: "Backend" },
  { name: ".NET", category: "Backend" },
  { name: "REST API Design", category: "Backend" },
  { name: "MongoDB", category: "Database" },
  { name: "PostgreSQL", category: "Database" },
  { name: "Redis", category: "Database" },
  { name: "Kafka", category: "Backend" },
  { name: "AWS", category: "Cloud" },
  { name: "Azure", category: "Cloud" },
  { name: "Docker", category: "DevOps" },
  { name: "Kubernetes", category: "DevOps" },
  { name: "Terraform", category: "DevOps" },
  { name: "CI/CD", category: "DevOps" },
  { name: "Selenium", category: "Testing" },
  { name: "Unit Testing", category: "Testing" },
  { name: "Security Auditing", category: "Security" },
  { name: "ETL", category: "Data" },
  { name: "Spark", category: "Data" },
  { name: "Project Management", category: "Management" },
  { name: "Scrum Facilitation", category: "Management" },
];

interface SeedEmployee {
  name: string;
  email: string;
  department: string;
  jobRole: JobRole;
  yearsOfExperience: number;
  location: string;
  availabilityPercent: number;
  skills: Array<[string, number, number]>;
}

const EMPLOYEES: SeedEmployee[] = [
  {
    name: "Alex Morgan",
    email: "alex.morgan@skillalloc.dev",
    department: "Engineering",
    jobRole: "TECH_LEAD",
    yearsOfExperience: 11,
    location: "Bengaluru",
    availabilityPercent: 40,
    skills: [["Java", 5, 9], ["Spring Boot", 5, 7], ["React", 4, 4], ["AWS", 4, 5], ["PostgreSQL", 4, 6], ["CI/CD", 4, 5], ["REST API Design", 5, 8], ["Project Management", 4, 4]],
  },
  {
    name: "Priya Sharma",
    email: "priya.sharma@skillalloc.dev",
    department: "Engineering",
    jobRole: "BACKEND_DEVELOPER",
    yearsOfExperience: 7,
    location: "Bengaluru",
    availabilityPercent: 70,
    skills: [["Python", 5, 6], ["FastAPI", 4, 3], ["PostgreSQL", 4, 5], ["Docker", 3, 3], ["REST API Design", 4, 5]],
  },
  {
    name: "Daniel Okafor",
    email: "daniel.okafor@skillalloc.dev",
    department: "Engineering",
    jobRole: "FRONTEND_DEVELOPER",
    yearsOfExperience: 5,
    location: "Remote",
    availabilityPercent: 80,
    skills: [["React", 5, 5], ["TypeScript", 5, 4], ["CSS & Design Systems", 4, 3], ["Next.js", 4, 2]],
  },
  {
    name: "Sofia Rossi",
    email: "sofia.rossi@skillalloc.dev",
    department: "Engineering",
    jobRole: "FULLSTACK_DEVELOPER",
    yearsOfExperience: 6,
    location: "Pune",
    availabilityPercent: 60,
    skills: [["TypeScript", 4, 5], ["Node.js", 4, 4], ["React", 4, 4], ["MongoDB", 4, 4], ["Docker", 3, 2]],
  },
  {
    name: "Marcus Chen",
    email: "marcus.chen@skillalloc.dev",
    department: "Engineering",
    jobRole: "BACKEND_DEVELOPER",
    yearsOfExperience: 9,
    location: "Singapore",
    availabilityPercent: 30,
    skills: [["Java", 5, 8], ["Spring Boot", 5, 7], ["Kafka", 3, 3], ["AWS", 4, 5], ["MongoDB", 3, 3]],
  },
  {
    name: "Yuki Tanaka",
    email: "yuki.tanaka@skillalloc.dev",
    department: "Platform & DevOps",
    jobRole: "DEVOPS_ENGINEER",
    yearsOfExperience: 8,
    location: "Tokyo",
    availabilityPercent: 50,
    skills: [["Kubernetes", 5, 6], ["Terraform", 5, 5], ["AWS", 5, 7], ["Docker", 5, 6], ["CI/CD", 4, 5]],
  },
  {
    name: "Omar Haddad",
    email: "omar.haddad@skillalloc.dev",
    department: "Platform & DevOps",
    jobRole: "DEVOPS_ENGINEER",
    yearsOfExperience: 5,
    location: "Dubai",
    availabilityPercent: 75,
    skills: [["Docker", 4, 4], ["Kubernetes", 3, 2], ["Azure", 4, 4], ["CI/CD", 4, 3], ["Terraform", 3, 2]],
  },
  {
    name: "Grace Mensah",
    email: "grace.mensah@skillalloc.dev",
    department: "Platform & DevOps",
    jobRole: "DEVOPS_ENGINEER",
    yearsOfExperience: 4,
    location: "Accra",
    availabilityPercent: 90,
    skills: [["Docker", 3, 2], ["AWS", 3, 3], ["CI/CD", 3, 2], ["Python", 3, 2]],
  },
  {
    name: "Liam O'Brien",
    email: "liam.obrien@skillalloc.dev",
    department: "Data & Analytics",
    jobRole: "DATA_ENGINEER",
    yearsOfExperience: 7,
    location: "Dublin",
    availabilityPercent: 65,
    skills: [["Python", 4, 5], ["Spark", 4, 4], ["ETL", 5, 5], ["AWS", 3, 3], ["PostgreSQL", 4, 4]],
  },
  {
    name: "Ananya Iyer",
    email: "ananya.iyer@skillalloc.dev",
    department: "Data & Analytics",
    jobRole: "DATA_ENGINEER",
    yearsOfExperience: 3,
    location: "Chennai",
    availabilityPercent: 85,
    skills: [["Python", 4, 3], ["ETL", 3, 2], ["Spark", 2, 1]],
  },
  {
    name: "Tomas Novak",
    email: "tomas.novak@skillalloc.dev",
    department: "Data & Analytics",
    jobRole: "BUSINESS_ANALYST",
    yearsOfExperience: 6,
    location: "Prague",
    availabilityPercent: 70,
    skills: [["Project Management", 4, 4], ["Scrum Facilitation", 4, 4], ["ETL", 3, 2]],
  },
  {
    name: "Hannah Berg",
    email: "hannah.berg@skillalloc.dev",
    department: "Quality Engineering",
    jobRole: "QA_ENGINEER",
    yearsOfExperience: 6,
    location: "Berlin",
    availabilityPercent: 55,
    skills: [["Selenium", 5, 5], ["Unit Testing", 4, 4], ["Python", 3, 3], ["CI/CD", 3, 3]],
  },
  {
    name: "Kwame Boateng",
    email: "kwame.boateng@skillalloc.dev",
    department: "Quality Engineering",
    jobRole: "QA_ENGINEER",
    yearsOfExperience: 4,
    location: "Lagos",
    availabilityPercent: 80,
    skills: [["Selenium", 4, 3], ["Unit Testing", 3, 3], ["Java", 3, 2]],
  },
  {
    name: "Mei Lin",
    email: "mei.lin@skillalloc.dev",
    department: "Quality Engineering",
    jobRole: "QA_ENGINEER",
    yearsOfExperience: 2,
    location: "Kuala Lumpur",
    availabilityPercent: 95,
    skills: [["Unit Testing", 3, 2], ["Selenium", 2, 1], ["Python", 2, 1]],
  },
  {
    name: "Rafael Costa",
    email: "rafael.costa@skillalloc.dev",
    department: "Security",
    jobRole: "SECURITY_ENGINEER",
    yearsOfExperience: 8,
    location: "Lisbon",
    availabilityPercent: 45,
    skills: [["Security Auditing", 5, 6], ["AWS", 4, 4], ["Kubernetes", 3, 2], ["Docker", 3, 3]],
  },
  {
    name: "Nadia Petrova",
    email: "nadia.petrova@skillalloc.dev",
    department: "Security",
    jobRole: "SECURITY_ENGINEER",
    yearsOfExperience: 5,
    location: "Sofia",
    availabilityPercent: 70,
    skills: [["Security Auditing", 4, 4], ["Docker", 3, 2], ["Azure", 3, 2]],
  },
  {
    name: "Ben Carter",
    email: "ben.carter@skillalloc.dev",
    department: "Engineering",
    jobRole: "MOBILE_DEVELOPER",
    yearsOfExperience: 5,
    location: "Manchester",
    availabilityPercent: 60,
    skills: [["React", 4, 3], ["TypeScript", 4, 4], ["REST API Design", 3, 2]],
  },
  {
    name: "Ines Duarte",
    email: "ines.duarte@skillalloc.dev",
    department: "Engineering",
    jobRole: "BACKEND_DEVELOPER",
    yearsOfExperience: 6,
    location: "Porto",
    availabilityPercent: 35,
    skills: [[".NET", 5, 5], ["Python", 3, 2], ["PostgreSQL", 4, 4], ["Azure", 4, 3]],
  },
  {
    name: "Samuel Adeyemi",
    email: "samuel.adeyemi@skillalloc.dev",
    department: "Engineering",
    jobRole: "PROJECT_MANAGER",
    yearsOfExperience: 12,
    location: "Lagos",
    availabilityPercent: 25,
    skills: [["Project Management", 5, 9], ["Scrum Facilitation", 5, 8], ["REST API Design", 3, 3]],
  },
  {
    name: "Julia Neumann",
    email: "julia.neumann@skillalloc.dev",
    department: "Engineering",
    jobRole: "UI_UX_DESIGNER",
    yearsOfExperience: 4,
    location: "Munich",
    availabilityPercent: 80,
    skills: [["CSS & Design Systems", 5, 4], ["React", 3, 2]],
  },
];

/** [skillName, requiredProficiency, importance] */
type SeedRequirement = [string, number, "REQUIRED" | "OPTIONAL"];

interface SeedProject {
  name: string;
  code: string;
  clientName: string;
  description: string;
  startOffsetDays: number;
  deadlineOffsetDays: number;
  status: string;
  priority: string;
  requiredTeamSize: number;
  requiredExperienceYears: number;
  progress: number;
  managerIndex: number;
  requirements: SeedRequirement[];
}

const PROJECTS: SeedProject[] = [
  {
    name: "Banking Application Modernisation",
    code: "PRJ-0001",
    clientName: "Northwind Bank",
    description:
      "Migrating a 12-year-old core banking platform to a modular, cloud-native architecture with offline batch processing removed.",
    startOffsetDays: -60,
    deadlineOffsetDays: 95,
    status: "ACTIVE",
    priority: "CRITICAL",
    requiredTeamSize: 5,
    requiredExperienceYears: 5,
    progress: 45,
    managerIndex: 19,
    requirements: [
      ["Python", 4, "REQUIRED"],
      ["PostgreSQL", 4, "REQUIRED"],
      ["React", 3, "REQUIRED"],
      ["Docker", 3, "OPTIONAL"],
      ["AWS", 3, "OPTIONAL"],
    ],
  },
  {
    name: "Retail Analytics Platform",
    code: "PRJ-0002",
    clientName: "Vantage Retail Group",
    description:
      "Consolidating point-of-sale data into a single analytics platform serving merchandising and finance.",
    startOffsetDays: -40,
    deadlineOffsetDays: 40,
    status: "ACTIVE",
    priority: "HIGH",
    requiredTeamSize: 4,
    requiredExperienceYears: 4,
    progress: 62,
    managerIndex: 19,
    requirements: [
      ["Python", 4, "REQUIRED"],
      ["Spark", 4, "REQUIRED"],
      ["ETL", 4, "REQUIRED"],
      ["AWS", 3, "OPTIONAL"],
    ],
  },
  {
    name: "Customer Portal Redesign",
    code: "PRJ-0003",
    clientName: "Helios Energy",
    description:
      "Rebuilding the customer self-service portal with a new design system and improved accessibility.",
    startOffsetDays: -25,
    deadlineOffsetDays: 70,
    status: "ACTIVE",
    priority: "HIGH",
    requiredTeamSize: 4,
    requiredExperienceYears: 3,
    progress: 30,
    managerIndex: 19,
    requirements: [
      ["React", 4, "REQUIRED"],
      ["TypeScript", 4, "REQUIRED"],
      ["CSS & Design Systems", 3, "REQUIRED"],
      ["Next.js", 3, "OPTIONAL"],
    ],
  },
  {
    name: "Payments Compliance Hardening",
    code: "PRJ-0004",
    clientName: "Northwind Bank",
    description:
      "Remediating audit findings ahead of the annual PCI-DSS assessment and introducing continuous security testing.",
    startOffsetDays: -15,
    deadlineOffsetDays: 12,
    status: "ACTIVE",
    priority: "CRITICAL",
    requiredTeamSize: 3,
    requiredExperienceYears: 6,
    progress: 55,
    managerIndex: 19,
    requirements: [
      ["Security Auditing", 4, "REQUIRED"],
      ["AWS", 3, "REQUIRED"],
      ["Docker", 3, "OPTIONAL"],
    ],
  },
  {
    name: "Logistics Fleet Telemetry",
    code: "PRJ-0005",
    clientName: "TransGlobal Logistics",
    description:
      "Ingesting vehicle telemetry, tracking cold-chain compliance and exposing an operations dashboard.",
    startOffsetDays: 10,
    deadlineOffsetDays: 150,
    status: "PLANNING",
    priority: "MEDIUM",
    requiredTeamSize: 5,
    requiredExperienceYears: 4,
    progress: 5,
    managerIndex: 19,
    requirements: [
      ["Python", 4, "REQUIRED"],
      ["ETL", 3, "REQUIRED"],
      ["Kubernetes", 3, "OPTIONAL"],
      ["Spark", 3, "OPTIONAL"],
    ],
  },
  {
    name: "Identity & Access Overhaul",
    code: "PRJ-0006",
    clientName: "Meridian Insurance",
    description:
      "Replacing a home-grown identity system with OIDC-based single sign-on across 14 internal applications.",
    startOffsetDays: 20,
    deadlineOffsetDays: 120,
    status: "PLANNING",
    priority: "HIGH",
    requiredTeamSize: 4,
    requiredExperienceYears: 7,
    progress: 0,
    managerIndex: 19,
    requirements: [
      ["Security Auditing", 4, "REQUIRED"],
      ["Java", 4, "REQUIRED"],
      ["REST API Design", 4, "REQUIRED"],
      ["Kubernetes", 3, "OPTIONAL"],
    ],
  },
  {
    name: "Mobile Field Service App",
    code: "PRJ-0007",
    clientName: "Vantage Retail Group",
    description:
      "Offline-capable field service application used by technicians at customer sites.",
    startOffsetDays: -120,
    deadlineOffsetDays: -20,
    status: "COMPLETED",
    priority: "MEDIUM",
    requiredTeamSize: 4,
    requiredExperienceYears: 4,
    progress: 100,
    managerIndex: 19,
    requirements: [
      ["React", 4, "REQUIRED"],
      ["TypeScript", 4, "REQUIRED"],
      ["REST API Design", 3, "REQUIRED"],
    ],
  },
  {
    name: "Data Warehouse Decommission",
    code: "PRJ-0008",
    clientName: "Meridian Insurance",
    description:
      "Retiring a legacy warehouse and migrating historical reporting onto the new platform.",
    startOffsetDays: -10,
    deadlineOffsetDays: 180,
    status: "ON_HOLD",
    priority: "LOW",
    requiredTeamSize: 3,
    requiredExperienceYears: 5,
    progress: 15,
    managerIndex: 19,
    requirements: [
      ["ETL", 4, "REQUIRED"],
      ["PostgreSQL", 3, "REQUIRED"],
      ["Python", 3, "OPTIONAL"],
    ],
  },
];

const TRAINING = [
  { title: "Docker for Application Teams", skillName: "Docker", level: "INTERMEDIATE", targetProficiency: 3, durationHours: 12, description: "Build, package and run containerised applications with confidence, including image hygiene and layer caching." },
  { title: "Docker Advanced", skillName: "Docker", level: "ADVANCED", targetProficiency: 4, durationHours: 20, description: "Multi-stage builds, security hardening, BuildKit caching and operating containers in production." },
  { title: "Kubernetes Fundamentals", skillName: "Kubernetes", level: "BEGINNER", targetProficiency: 2, durationHours: 16, description: "Pods, deployments, services and configuration for engineers who have never run a cluster." },
  { title: "Kubernetes Advanced", skillName: "Kubernetes", level: "ADVANCED", targetProficiency: 4, durationHours: 24, description: "Helm, autoscaling, network policies and debugging a failing workload under load." },
  { title: "AWS Solutions Architect Essentials", skillName: "AWS", level: "INTERMEDIATE", targetProficiency: 3, durationHours: 24, description: "Designing secure, cost-aware architectures on AWS covering compute, storage and networking." },
  { title: "Advanced AWS Architecture", skillName: "AWS", level: "ADVANCED", targetProficiency: 4, durationHours: 20, description: "Multi-account strategy, well-architected reviews and resilience patterns for critical systems." },
  { title: "Python Service Development", skillName: "Python", level: "INTERMEDIATE", targetProficiency: 3, durationHours: 18, description: "Typing, packaging, async I/O and testing patterns for maintainable Python services." },
  { title: "Advanced Python Engineering", skillName: "Python", level: "ADVANCED", targetProficiency: 4, durationHours: 22, description: "Profiling, concurrency at scale and designing resilient service boundaries in Python." },
  { title: "PostgreSQL Performance Tuning", skillName: "PostgreSQL", level: "ADVANCED", targetProficiency: 4, durationHours: 16, description: "Reading query plans, indexing strategy and fixing production performance regressions." },
  { title: "React in Production", skillName: "React", level: "ADVANCED", targetProficiency: 4, durationHours: 20, description: "State architecture, rendering performance, error boundaries and testing user interfaces." },
  { title: "TypeScript Strictness", skillName: "TypeScript", level: "INTERMEDIATE", targetProficiency: 3, durationHours: 10, description: "Turning on strict mode safely and modelling real domains with discriminated unions." },
  { title: "Application Security Auditing", skillName: "Security Auditing", level: "ADVANCED", targetProficiency: 4, durationHours: 18, description: "Threat modelling, dependency risk review and producing findings a delivery team can act on." },
  { title: "ETL and Data Pipelines", skillName: "ETL", level: "INTERMEDIATE", targetProficiency: 3, durationHours: 14, description: "Designing idempotent, observable pipelines that recover cleanly from failures." },
  { title: "Apache Spark at Scale", skillName: "Spark", level: "ADVANCED", targetProficiency: 4, durationHours: 20, description: "Partitioning, shuffles and tuning large Spark jobs to meet latency targets." },
  { title: "Selenium Test Automation", skillName: "Selenium", level: "INTERMEDIATE", targetProficiency: 3, durationHours: 12, description: "Building reliable, maintainable browser automation that does not become flaky." },
  { title: "CI/CD Pipeline Design", skillName: "CI/CD", level: "INTERMEDIATE", targetProficiency: 3, durationHours: 12, description: "Designing pipelines that gate quality without slowing delivery to a crawl." },
  { title: "Terraform in Practice", skillName: "Terraform", level: "ADVANCED", targetProficiency: 4, durationHours: 16, description: "Reusable modules, state management and safe change workflows for infrastructure as code." },
];

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function clearAll(): Promise<void> {
  await Promise.all([
    AllocationModel.deleteMany({}),
    EmployeeModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    TrainingModel.deleteMany({}),
    SkillModel.deleteMany({}),
    DepartmentModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
}

async function main(): Promise<void> {
  console.log("Connecting to MongoDB...");
  await connectDB();

  if (RESET) {
    console.log("Resetting collections...");
    await clearAll();
  } else {
    const existing = await EmployeeModel.countDocuments();
    if (existing > 0) {
      console.log(
        `Database already contains ${existing} employee(s). Nothing to do.`
      );
      console.log("Run `npm run seed:reset` to wipe and re-seed.");
      await disconnectDB();
      return;
    }
  }

  /* Departments */
  const departmentDocs = await DepartmentModel.insertMany(DEPARTMENTS);
  const departmentByName = new Map(
    departmentDocs.map((department) => [department.name, department._id])
  );
  console.log(`Inserted ${departmentDocs.length} departments`);

  /* Skills */
  const skillDocs = await SkillModel.insertMany(
    SKILLS.map((skill) => ({
      name: skill.name,
      slug: skill.name.trim().toLowerCase(),
      category: skill.category,
    }))
  );
  const skillByName = new Map(skillDocs.map((skill) => [skill.name, skill._id]));
  console.log(`Inserted ${skillDocs.length} skills`);

  /* Employees */
  const employeeDocs = await EmployeeModel.insertMany(
    EMPLOYEES.map((employee, index) => {
      const departmentId = departmentByName.get(employee.department);
      const skills = employee.skills.map(([name, proficiency, years]) => {
        const skillId = skillByName.get(name);
        if (!skillId) {
          throw new Error(`Unknown skill "${name}" referenced by ${employee.name}`);
        }
        return { skillId, proficiency, yearsOfExperience: years };
      });

      return {
        employeeId: `EMP-${String(index + 1).padStart(4, "0")}`,
        name: employee.name,
        email: employee.email,
        departmentId: departmentId ?? null,
        jobRole: employee.jobRole,
        status: "ACTIVE",
        yearsOfExperience: employee.yearsOfExperience,
        location: employee.location,
        availabilityPercent: employee.availabilityPercent,
        skills,
        certifications:
          index % 4 === 0
            ? [
                {
                  name: "AWS Certified Solutions Architect",
                  issuer: "Amazon Web Services",
                  issuedOn: daysFromNow(-400),
                },
              ]
            : [],
      };
    })
  );
  const employeeByName = new Map(employeeDocs.map((e) => [e.name, e._id]));
  console.log(`Inserted ${employeeDocs.length} employees`);

  /* Projects */
  const managerId = employeeByName.get("Samuel Adeyemi");
  const projectDocs = await ProjectModel.insertMany(
    PROJECTS.map((project) => ({
      name: project.name,
      code: project.code,
      clientName: project.clientName,
      description: project.description,
      startDate: daysFromNow(project.startOffsetDays),
      deadline: daysFromNow(project.deadlineOffsetDays),
      status: project.status,
      priority: project.priority,
      requiredTeamSize: project.requiredTeamSize,
      requiredExperienceYears: project.requiredExperienceYears,
      progress: project.progress,
      managerId: managerId ?? null,
      createdBy: managerId ?? null,
      requirements: project.requirements.map(([name, level, importance]) => {
        const skillId = skillByName.get(name);
        if (!skillId) {
          throw new Error(`Unknown skill "${name}" required by ${project.code}`);
        }
        return { skillId, requiredProficiency: level, importance };
      }),
    }))
  );
  console.log(`Inserted ${projectDocs.length} projects`);

  /* Allocations — deliberately uneven so workload bands are all represented. */
  const allocations: Array<Record<string, unknown>> = [];
  const push = (
    employeeName: string,
    projectCode: string,
    allocationPercent: number,
    roleInProject: string
  ) => {
    const employeeId = employeeByName.get(employeeName);
    const project = projectDocs.find((entry) => entry.code === projectCode);
    if (!employeeId || !project) {
      throw new Error(`Cannot allocate ${employeeName} to ${projectCode}`);
    }
    allocations.push({
      employeeId,
      projectId: project._id,
      allocationPercent,
      roleInProject,
      startDate: project.startDate,
      status: "ACTIVE",
    });
  };

  push("Alex Morgan", "PRJ-0001", 60, "Technical Lead");
  push("Priya Sharma", "PRJ-0001", 70, "Backend Engineer");
  push("Daniel Okafor", "PRJ-0001", 40, "Frontend Engineer");
  push("Marcus Chen", "PRJ-0001", 50, "Backend Engineer");
  push("Grace Mensah", "PRJ-0001", 25, "Platform Engineer");

  push("Liam O'Brien", "PRJ-0002", 55, "Data Engineer");
  push("Ananya Iyer", "PRJ-0002", 60, "Data Engineer");
  push("Tomas Novak", "PRJ-0002", 30, "Business Analyst");
  push("Yuki Tanaka", "PRJ-0002", 20, "Infrastructure Support");

  push("Daniel Okafor", "PRJ-0003", 35, "Frontend Engineer");
  push("Sofia Rossi", "PRJ-0003", 40, "Full Stack Engineer");
  push("Julia Neumann", "PRJ-0003", 45, "UI Designer");
  push("Ben Carter", "PRJ-0003", 30, "Frontend Engineer");

  push("Rafael Costa", "PRJ-0004", 50, "Security Engineer");
  push("Nadia Petrova", "PRJ-0004", 45, "Security Engineer");
  push("Omar Haddad", "PRJ-0004", 35, "Platform Engineer");

  push("Samuel Adeyemi", "PRJ-0001", 20, "Project Manager");
  push("Samuel Adeyemi", "PRJ-0003", 15, "Project Manager");

  await AllocationModel.insertMany(allocations);
  console.log(`Inserted ${allocations.length} allocations`);

  /* Training catalogue */
  await TrainingModel.insertMany(
    TRAINING.map((course) => {
      const skillId = skillByName.get(course.skillName);
      if (!skillId) {
        throw new Error(`Unknown skill "${course.skillName}" in training catalogue`);
      }
      return {
        title: course.title,
        description: course.description,
        skillId,
        skillName: course.skillName,
        targetProficiency: course.targetProficiency,
        level: course.level,
        provider: "Internal Academy",
        durationHours: course.durationHours,
        isInternal: true,
        tags: [course.skillName, course.level.toLowerCase()],
      };
    })
  );
  console.log(`Inserted ${TRAINING.length} training courses`);

  /* Demo Auth.js users so the app is usable without a Google account.
     Google sign-in creates a real user; these are only for local development. */
  await UserModel.insertMany([
    {
      name: "Samuel Adeyemi",
      email: "samuel.adeyemi@skillalloc.dev",
      role: "ADMIN",
      isActive: true,
      calendarConnected: false,
    },
    {
      name: "Alex Morgan",
      email: "alex.morgan@skillalloc.dev",
      role: "PROJECT_MANAGER",
      isActive: true,
      calendarConnected: false,
    },
    {
      name: "Priya Sharma",
      email: "priya.sharma@skillalloc.dev",
      role: "EMPLOYEE",
      isActive: true,
      calendarConnected: false,
    },
  ]);

  // Link the demo accounts to their employee profiles so that notifications,
  // self-service profile edits and calendar settings all resolve correctly.
  const samuel = await UserModel.findOne({ email: "samuel.adeyemi@skillalloc.dev" }).lean();
  const alex = await UserModel.findOne({ email: "alex.morgan@skillalloc.dev" }).lean();
  const priya = await UserModel.findOne({ email: "priya.sharma@skillalloc.dev" }).lean();

  if (samuel) {
    await EmployeeModel.updateOne(
      { employeeId: "EMP-0020" },
      { userId: samuel._id }
    );
  }
  if (alex) {
    await EmployeeModel.updateOne({ employeeId: "EMP-0001" }, { userId: alex._id });
  }
  if (priya) {
    await EmployeeModel.updateOne({ employeeId: "EMP-0002" }, { userId: priya._id });
  }
  console.log("Inserted 3 demo user accounts (linked to employee profiles)");

  /* Workload snapshots */
  const workloadCount = await recomputeAllWorkloads();
  console.log(`Recomputed workload for ${workloadCount} employee(s)`);

  console.log("\nSeed complete.");
  console.log("Demo accounts (development only):");
  console.log("  ADMIN           samuel.adeyemi@skillalloc.dev");
  console.log("  PROJECT_MANAGER alex.morgan@skillalloc.dev");
  console.log("  EMPLOYEE        priya.sharma@skillalloc.dev");
  console.log(
    "\nEnable ENABLE_DEV_CREDENTIALS=true in .env.local to sign in with these accounts."
  );

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});