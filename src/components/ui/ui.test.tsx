import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "./badge";
import { Button, IconButton } from "./button";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";
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
import { TabsList, TabsPanel, TabsTrigger } from "./tabs";
import { Textarea } from "./textarea";

function TabsDemo() {
  const [tab, setTab] = useState("a");
  return (
    <>
      <TabsList>
        <TabsTrigger
          id="demo-tab-a"
          aria-controls="demo-tab-panel"
          active={tab === "a"}
          onClick={() => setTab("a")}
        >
          Alpha
        </TabsTrigger>
        <TabsTrigger
          id="demo-tab-b"
          aria-controls="demo-tab-panel"
          active={tab === "b"}
          onClick={() => setTab("b")}
        >
          Beta
        </TabsTrigger>
      </TabsList>
      <TabsPanel
        id="demo-tab-panel"
        aria-labelledby={tab === "a" ? "demo-tab-a" : "demo-tab-b"}
      >
        Panel {tab}
      </TabsPanel>
    </>
  );
}

describe("ui components", () => {
  it("renders Button variants and handles click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Default</Button>
        <Button variant="accent">Accent</Button>
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
    expect(screen.getByRole("button", { name: "Accent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Outline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ghost" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("renders IconButton with accessible name", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Refresh" onClick={onClick}>
        R
      </IconButton>,
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders Badge variants", () => {
    render(
      <>
        <Badge>Default</Badge>
        <Badge variant="github">GitHub</Badge>
        <Badge variant="error">Error</Badge>
      </>,
    );
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders Tabs and toggles active trigger", async () => {
    const user = userEvent.setup();
    render(<TabsDemo />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute(
      "aria-controls",
      "demo-tab-panel",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "demo-tab-a",
    );
    await user.click(screen.getByRole("tab", { name: "Beta" }));
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel b");
  });

  it("moves focus between tabs with arrow keys", async () => {
    const user = userEvent.setup();
    render(<TabsDemo />);
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    alpha.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("supports Home/End keys and callback refs", async () => {
    const user = userEvent.setup();
    const listRef = vi.fn();
    function Demo() {
      const [tab, setTab] = useState("a");
      return (
        <TabsList ref={listRef} size="sm">
          <TabsTrigger active={tab === "a"} onClick={() => setTab("a")}>
            One
          </TabsTrigger>
          <TabsTrigger active={tab === "b"} onClick={() => setTab("b")}>
            Two
          </TabsTrigger>
          <TabsTrigger active={tab === "c"} onClick={() => setTab("c")}>
            Three
          </TabsTrigger>
        </TabsList>
      );
    }
    render(
      <>
        <Demo />
        <TabsPanel active={false}>Hidden</TabsPanel>
      </>,
    );
    expect(listRef).toHaveBeenCalled();
    const one = screen.getByRole("tab", { name: "One" });
    one.focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
  });

  it("renders Card surface", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Subtitle</CardDescription>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Subtitle")).toBeInTheDocument();
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
    expect(
      screen.getByRole("combobox", { name: "Pick one" }),
    ).toHaveTextContent("Alpha");
    await user.click(screen.getByRole("combobox", { name: "Pick one" }));
    await user.click(screen.getByRole("option", { name: "Beta" }));
    expect(
      screen.getByRole("combobox", { name: "Pick one" }),
    ).toHaveTextContent("Beta");
  });
});
