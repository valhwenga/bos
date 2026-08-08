import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Star, Users, Send } from "lucide-react";
import { PerformanceAdvancedStore, type Review360 } from "@/lib/performanceAdvanced";
import { HRMStore } from "@/lib/hrmStore";
import { UserStore } from "@/lib/userStore";

type Props = {
  employeeId: string;
  employeeName: string;
};

export function Review360Form({ employeeId, employeeName }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "form">("select");
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [form, setForm] = useState({
    relationship: "peer" as Review360["relationship"],
    ratings: {} as Record<string, number>,
    strengths: [] as string[],
    improvements: [] as string[],
  });
  const [strengthInput, setStrengthInput] = useState("");
  const [improveInput, setImproveInput] = useState("");
  const user = UserStore.get();

  const employees = HRMStore.list().filter(e => e.id !== employeeId);
  const categories = ["Quality of Work", "Teamwork", "Communication", "Initiative", "Leadership", "Punctuality"];

  const startReview = () => {
    setStep("form");
    setForm({
      relationship: "peer",
      ratings: {},
      strengths: [],
      improvements: [],
    });
  };

  const addReviewer = (reviewerId: string) => {
    setSelectedReviewers([...selectedReviewers, reviewerId]);
  };

  const removeReviewer = (reviewerId: string) => {
    setSelectedReviewers(selectedReviewers.filter(id => id !== reviewerId));
  };

  const setRating = (category: string, value: number) => {
    setForm({ ...form, ratings: { ...form.ratings, [category]: value } });
  };

  const addStrength = () => {
    if (strengthInput.trim()) {
      setForm({ ...form, strengths: [...form.strengths, strengthInput.trim()] });
      setStrengthInput("");
    }
  };

  const removeStrength = (idx: number) => {
    setForm({ ...form, strengths: form.strengths.filter((_, i) => i !== idx) });
  };

  const addImprovement = () => {
    if (improveInput.trim()) {
      setForm({ ...form, improvements: [...form.improvements, improveInput.trim()] });
      setImproveInput("");
    }
  };

  const removeImprovement = (idx: number) => {
    setForm({ ...form, improvements: form.improvements.filter((_, i) => i !== idx) });
  };

  const submit = () => {
    const review: Review360 = {
      id: `R360${Date.now()}`,
      employeeId,
      reviewerId: user.id || "",
      relationship: form.relationship,
      ratings: form.ratings,
      strengths: form.strengths,
      improvements: form.improvements,
      submittedAt: new Date().toISOString(),
    };
    PerformanceAdvancedStore.upsert360(review);
    setOpen(false);
    setStep("select");
    setSelectedReviewers([]);
    setForm({ relationship: "peer", ratings: {}, strengths: [], improvements: [] });
  };

  const invitePeers = () => {
    // In a real app, send email/notification to selected peers
    alert(`Invitation sent to: ${selectedReviewers.map(id => employees.find(e => e.id === id)?.name).join(", ")}`);
    setSelectedReviewers([]);
  };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          360° Review
        </h4>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Send className="w-4 h-4 mr-2" />
          Request Review
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>360° Review for {employeeName}</DialogTitle>
          </DialogHeader>
          {step === "select" ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Peer Reviewers</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {employees.map((e) => (
                    <Badge
                      key={e.id}
                      variant={selectedReviewers.includes(e.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => selectedReviewers.includes(e.id) ? removeReviewer(e.id) : addReviewer(e.id)}
                    >
                      {e.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={invitePeers} disabled={selectedReviewers.length === 0}>
                  Invite Selected ({selectedReviewers.length})
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Your Relationship</label>
                <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v as Review360["relationship"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Self</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="peer">Peer</SelectItem>
                    <SelectItem value="direct_report">Direct Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Ratings (1-5)</label>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-sm">{cat}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Button
                            key={n}
                            size="icon"
                            variant={form.ratings[cat] === n ? "default" : "outline"}
                            onClick={() => setRating(cat, n)}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Strengths</label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add a strength"
                    value={strengthInput}
                    onChange={(e) => setStrengthInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStrength())}
                  />
                  <Button onClick={addStrength}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.strengths.map((s, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeStrength(i)}>
                      {s} ✕
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Areas for Improvement</label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add an improvement"
                    value={improveInput}
                    onChange={(e) => setImproveInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImprovement())}
                  />
                  <Button onClick={addImprovement}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.improvements.map((imp, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeImprovement(i)}>
                      {imp} ✕
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep("select")}>Back</Button>
                <Button onClick={submit} disabled={Object.keys(form.ratings).length === 0}>
                  Submit Review
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
