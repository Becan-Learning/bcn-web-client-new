// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";
import { QuestionForm } from "./question-form";

afterEach(cleanup);

function setup(onSend: (text: string) => Promise<boolean>, locale: "ar" | "en" = "ar") {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
      <QuestionForm onSend={onSend} />
    </NextIntlClientProvider>,
  );
  return user;
}

describe("QuestionForm", () => {
  it.each(["ar", "en"] as const)("sends the typed question with Enter and clears the box (%s)", async (locale) => {
    const onSend = vi.fn(async () => true);
    const user = setup(onSend, locale);
    const messages = (locale === "ar" ? ar : en).Demo;
    await user.type(screen.getByLabelText(messages.questionLabel), "ما هو الرأس؟{Enter}");
    expect(onSend).toHaveBeenCalledExactlyOnceWith("ما هو الرأس؟");
    expect(screen.getByLabelText<HTMLInputElement>(messages.questionLabel).value).toBe("");
  });

  it("sends with the Send button, a real <button>, at least 44px tall", async () => {
    const onSend = vi.fn(async () => true);
    const user = setup(onSend, "en");
    await user.type(screen.getByLabelText(en.Demo.questionLabel), "why?");
    const button = screen.getByRole("button", { name: en.Demo.send });
    expect(button.tagName).toBe("BUTTON");
    expect(button.className).toContain("min-h-11");
    await user.click(button);
    expect(onSend).toHaveBeenCalledExactlyOnceWith("why?");
  });

  it("sends nothing while the box is blank", async () => {
    const onSend = vi.fn(async () => true);
    const user = setup(onSend, "en");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: en.Demo.send }).disabled).toBe(true);
    await user.type(screen.getByLabelText(en.Demo.questionLabel), "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps the text when the question could not be sent", async () => {
    const onSend = vi.fn(async () => false);
    const user = setup(onSend, "en");
    await user.type(screen.getByLabelText(en.Demo.questionLabel), "why?{Enter}");
    expect(screen.getByLabelText<HTMLInputElement>(en.Demo.questionLabel).value).toBe("why?");
  });
});
