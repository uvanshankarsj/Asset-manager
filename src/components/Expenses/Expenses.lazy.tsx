import { lazy, Suspense } from "react";
export const ExpensesLazy = lazy(() => import("./Expenses"));

export const Expenses = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ExpensesLazy />
    </Suspense>
  );
};
