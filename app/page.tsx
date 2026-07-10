import { TasksProvider } from "@/components/tasks-provider";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <TasksProvider>
      <AppShell />
    </TasksProvider>
  );
}
