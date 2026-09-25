import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isJavaApiEnabled, javaApiBaseUrl } from "@/lib/java-api";

describe("java-api", () => {
  const prev = process.env.JAVA_API_BASE_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.JAVA_API_BASE_URL;
    else process.env.JAVA_API_BASE_URL = prev;
  });

  beforeEach(() => {
    delete process.env.JAVA_API_BASE_URL;
  });

  it("disabled without env", () => {
    expect(isJavaApiEnabled()).toBe(false);
    expect(javaApiBaseUrl()).toBeNull();
  });

  it("strips trailing slash", () => {
    process.env.JAVA_API_BASE_URL = "http://localhost:8080/";
    expect(javaApiBaseUrl()).toBe("http://localhost:8080");
    expect(isJavaApiEnabled()).toBe(true);
  });
});
