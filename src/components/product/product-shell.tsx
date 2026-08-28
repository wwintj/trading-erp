import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProductShell({
  appName,
  title,
  description,
  actions,
  children,
}: {
  appName: string;
  title: string;
  description: string;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-neutral-500">{appName}</p>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">{actions}</div>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
