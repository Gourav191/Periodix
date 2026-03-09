import { History, Clock } from 'lucide-react';

export default function VersionHistory() {
  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Version History</h1>
        <p className="page-description">View past timetable versions and changes</p>
      </div>

      <div className="card-soft p-12 text-center">
        <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium text-foreground mb-2">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Version history will allow you to view and restore previous timetable versions.
          This feature is under development.
        </p>
        
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Expected in a future update</span>
        </div>
      </div>
    </div>
  );
}
