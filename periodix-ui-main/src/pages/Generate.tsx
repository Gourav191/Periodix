import { useState,useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { Zap, CheckCircle2, AlertTriangle, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusCard, StatItem, WarningItem } from "@/components/StatusCard";
import { SemesterSelector, BatchSelector } from "@/components/Selectors";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import {
  generateTimetable,
  downloadTimetablePdf,
  saveBlob,
  type GenerateResult,
} from "@/lib/api";

export default function Generate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedSemesterId, setSelectedTimetableId, setLastGenerateResult } =
    useAppStore();

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  
  const handleGenerate = async () => {
    if (!selectedSemesterId) {
      toast({
        title: "No semester selected",
        description: "Please select a semester first.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    const res = await generateTimetable(selectedSemesterId);

    if (res.error || !res.data) {
      toast({
        title: "Generation failed",
        description: res.error || "Unknown error",
        variant: "destructive",
      });
      setGenerating(false);
      return;
    }

    toast({ title: "Timetable generated successfully" });
    setResult(res.data);
    setSelectedTimetableId(res.data.timetableId);
    setLastGenerateResult(res.data);

    setGenerating(false);
  };

  const handleDownloadPdf = async () => {
    if (!result?.timetableId) return;

    toast({ title: "Downloading PDF..." });
    const res = await downloadTimetablePdf(result.timetableId);

    if (res.error || !res.data) {
      toast({
        title: "Download failed",
        description: res.error || "PDF download failed",
        variant: "destructive",
      });
      return;
    }

    saveBlob(res.data, `timetable-${result.timetableId}.pdf`);
    toast({ title: "Downloaded", description: "PDF saved successfully." });
  };

  const warnings = result?.warnings || [];
  const highWarnings = warnings.filter(
    (w) => w.toLowerCase().includes("error") || w.toLowerCase().includes("conflict")
  );
  const mediumWarnings = warnings.filter((w) => !highWarnings.includes(w));

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <h1 className="page-title">Generate Timetable</h1>
        <p className="page-description">
          Generate a new timetable for the selected semester
        </p>
      </div>

      {/* Selectors */}
      <div className="card-soft p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <BatchSelector />
          <SemesterSelector />
        </div>
      </div>

      {/* Generate Button */}
      <div className="card-soft p-8 text-center mb-6">
        <Zap className="w-12 h-12 mx-auto text-primary mb-4" />
        <h3 className="font-medium text-foreground mb-2">Ready to Generate</h3>
        <p className="text-sm text-muted-foreground mb-6">
          This will create a new timetable based on your current assignments.
        </p>

        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={generating || !selectedSemesterId}
          className="gap-2"
        >
          {generating ? (
            <>
              <LoadingSpinner size="sm" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Timetable
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          <StatusCard
            title="Generation Complete"
            icon={<CheckCircle2 className="w-4 h-4 text-success" />}
            actions={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/timetable")}
                  className="gap-1"
                >
                  <Eye className="w-4 h-4" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  className="gap-1"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </Button>
              </div>
            }
          >
            <div className="space-y-1">
              <StatItem
                label="Timetable ID"
                value={result.timetableId.slice(0, 12) + "..."}
              />
              <StatItem
                label="Entries Created"
                value={result.insertedEntries}
                status="success"
              />
              <StatItem
                label="Warnings"
                value={warnings.length}
                status={warnings.length > 0 ? "warning" : "success"}
              />
            </div>
          </StatusCard>

          {Object.keys(result.facultyHours || {}).length > 0 && (
            <StatusCard title="Faculty Hours Assigned">
              <div className="space-y-1">
                {Object.entries(result.facultyHours).map(([facultyId, hours]) => (
                  <StatItem
                    key={facultyId}
                    label={facultyId.slice(0, 8) + "..."}
                    value={`${hours}h`}
                  />
                ))}
              </div>
            </StatusCard>
          )}

          {warnings.length > 0 && (
            <StatusCard
              title="Warnings"
              icon={<AlertTriangle className="w-4 h-4 text-warning" />}
            >
              <div className="space-y-2">
                {highWarnings.map((w, i) => (
                  <WarningItem key={i} message={w} level="high" />
                ))}
                {mediumWarnings.map((w, i) => (
                  <WarningItem key={i} message={w} level="medium" />
                ))}
              </div>
            </StatusCard>
          )}
        </div>
      )}
    </div>
  );
}
