import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Textarea } from "./textarea";

describe("ui components", () => {
  it("renders Button variants and handles click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost" size="sm">
          Ghost
        </Button>
        <Button variant="destructive" size="lg">
          Delete
        </Button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Default" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Outline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ghost" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("renders Input and Textarea with user input", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Input aria-label="name" placeholder="Enter name" />
        <Textarea aria-label="notes" placeholder="Notes" />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "name" });
    const textarea = screen.getByRole("textbox", { name: "notes" });
    await user.type(input, "alice");
    await user.type(textarea, "hello");
    expect(input).toHaveValue("alice");
    expect(textarea).toHaveValue("hello");
  });

  it("opens and closes Dialog", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent side="center">
          <DialogHeader>
            <DialogTitle>Test dialog</DialogTitle>
            <DialogDescription>Dialog body</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Select shows value after choosing an item", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="a">
        <SelectTrigger aria-label="Pick one">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "Pick one" })).toHaveTextContent(
      "Alpha",
    );
    await user.click(screen.getByRole("combobox", { name: "Pick one" }));
    await user.click(screen.getByRole("option", { name: "Beta" }));
    expect(screen.getByRole("combobox", { name: "Pick one" })).toHaveTextContent(
      "Beta",
    );
  });
});
