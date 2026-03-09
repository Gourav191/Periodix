import { useState, useEffect } from 'react';
import { Plus, BookOpen, Beaker, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusCard } from '@/components/StatusCard';
import { DataTable } from '@/components/DataTable';
import { SemesterSelector, BatchSelector } from '@/components/Selectors';
import { LoadingSpinner, LoadingState } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import { createSubject, getSubjects, type Subject } from '@/lib/api';

export default function SemesterSetup() {
  const { toast } = useToast();
  const { selectedSemesterId } = useAppStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'THEORY' as 'THEORY' | 'LAB' | 'NON_CREDIT',
    labDurationHours: 2,
  });

  useEffect(() => {
    if (!selectedSemesterId) {
      setSubjects([]);
      return;
    }

    const fetchSubjects = async () => {
      setLoading(true);
      const result = await getSubjects(selectedSemesterId);
      if (result.data) {
        setSubjects(result.data);
      }
      setLoading(false);
    };

    fetchSubjects();
  }, [selectedSemesterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSemesterId) {
      toast({
        title: 'No semester selected',
        description: 'Please select a semester first.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      name: form.name,
      code: form.code,
      type: form.type,
      ...(form.type === 'LAB' && { labDurationHours: form.labDurationHours }),
    };

    const result = await createSubject(selectedSemesterId, payload);

    if (result.error) {
      toast({
        title: 'Error adding subject',
        description: result.error,
        variant: 'destructive',
      });
    } else if (result.data) {
      toast({ title: 'Subject added successfully' });
      setSubjects([...subjects, result.data]);
      setForm({ name: '', code: '', type: 'THEORY', labDurationHours: 2 });
    }

    setSubmitting(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'LAB':
        return <Beaker className="w-4 h-4" />;
      case 'NON_CREDIT':
        return <FileText className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Semester Setup</h1>
        <p className="page-description">Configure subjects for each semester</p>
      </div>

      {/* Selectors */}
      <div className="card-soft p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <BatchSelector />
          <SemesterSelector />
        </div>
      </div>

      {!selectedSemesterId ? (
        <div className="card-soft p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-foreground mb-2">No Semester Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a batch and semester to configure subjects.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add Subject Form */}
          <StatusCard title="Add Subject" icon={<Plus className="w-4 h-4" />}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Data Structures"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Subject Code</Label>
                <Input
                  id="code"
                  placeholder="e.g., CS201"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm({ ...form, type: value as 'THEORY' | 'LAB' | 'NON_CREDIT' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THEORY">Theory</SelectItem>
                    <SelectItem value="LAB">Lab</SelectItem>
                    <SelectItem value="NON_CREDIT">Non-Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type === 'LAB' && (
                <div className="space-y-2">
                  <Label htmlFor="labDuration">Lab Duration (Hours)</Label>
                  <Select
                    value={form.labDurationHours.toString()}
                    onValueChange={(value) =>
                      setForm({ ...form, labDurationHours: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 hours</SelectItem>
                      <SelectItem value="3">3 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <LoadingSpinner size="sm" /> : 'Add Subject'}
              </Button>
            </form>
          </StatusCard>

          {/* Subjects List */}
          <div className="md:col-span-2">
            <StatusCard title="Subjects" icon={<BookOpen className="w-4 h-4" />}>
              {loading ? (
                <LoadingState message="Loading subjects..." />
              ) : (
                <DataTable
                  data={subjects}
                  columns={[
                    { key: 'code', header: 'Code', className: 'font-mono' },
                    { key: 'name', header: 'Name' },
                    {
                      key: 'type',
                      header: 'Type',
                      render: (item) => (
                        <div className="flex items-center gap-2">
                          {getTypeIcon(item.type)}
                          <span className="text-muted-foreground">
                            {item.type}
                            {item.type === 'LAB' && ` (${item.labDurationHours}h)`}
                          </span>
                        </div>
                      ),
                    },
                  ]}
                  emptyMessage="No subjects added yet"
                />
              )}
            </StatusCard>
          </div>
        </div>
      )}
    </div>
  );
}
