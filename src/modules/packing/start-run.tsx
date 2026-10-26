"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startRun } from "./actions";
import { conditions, defaultConditions, defaultTitle } from "./data";

type Template = { id: string; name: string; route: string | null };

type Props = {
  templates: Template[];
  // YYYY-MM-DD, passed from the server so rendering doesn't depend on the client's clock.
  today: string;
};

export function StartRun({ templates, today }: Props) {
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState<string | null>(null);
  const [active, setActive] = useState<string[]>(defaultConditions(new Date(`${today}T00:00:00`)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>Neue Reise</h2>
        </CardTitle>
        <CardDescription>Startet eine frische Liste aus einer Vorlage.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={startRun} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="run-template">Vorlage</Label>
              <Select name="templateId" defaultValue={templates[0]?.id} required>
                <SelectTrigger id="run-template" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.route && <span className="text-muted-foreground">{template.route}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-date">Datum</Label>
              <Input
                id="run-date"
                type="date"
                name="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-title">Name</Label>
              <Input
                id="run-title"
                name="title"
                maxLength={80}
                value={title ?? (date ? defaultTitle(date) : "")}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Diesmal dabei</legend>
            <div className="flex flex-wrap gap-2">
              {conditions.map((condition) => {
                const checked = active.includes(condition.value);
                return (
                  <Label
                    key={condition.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 font-normal ${
                      checked ? "border-brand bg-good text-good-foreground" : ""
                    }`}
                  >
                    <Checkbox
                      name="conditions"
                      value={condition.value}
                      checked={checked}
                      onCheckedChange={(next) =>
                        setActive(
                          next ? [...active, condition.value] : active.filter((value) => value !== condition.value),
                        )
                      }
                    />
                    {condition.label}
                  </Label>
                );
              })}
            </div>
          </fieldset>

          <Button size="lg" disabled={templates.length === 0}>
            Liste starten
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
