import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useQueryValue } from "../../preview/nav";
import { currentHref, navigate, usePathname, useRouter } from "../../preview/next-navigation";

describe("the one-file preview keeps its screen in memory", () => {
  it("goes to a screen with its query, remembers it for a reload, and steps back", () => {
    const path = renderHook(() => usePathname());
    const router = renderHook(() => useRouter());
    act(() => navigate("/sign-up/swimmers?child=2"));
    expect(path.result.current).toBe("/sign-up/swimmers");
    const child = renderHook(() => useQueryValue("child"));
    expect(child.result.current).toBe("2");
    expect(window.sessionStorage.getItem("popsicle-pier-preview-screen")).toBe("/sign-up/swimmers?child=2");
    expect(document.documentElement.dataset.previewScreen).toBe("/sign-up/swimmers?child=2");

    act(() => router.result.current.push("/sign-up/stage"));
    expect(path.result.current).toBe("/sign-up/stage");
    act(() => router.result.current.back());
    expect(currentHref()).toBe("/sign-up/swimmers?child=2");

    // Replacing a screen doesn't add a step: back goes to the one before it.
    act(() => router.result.current.replace("/more"));
    act(() => router.result.current.back());
    expect(currentHref()).toBe("/");
  });
});
