"use client";

import { ItensForm as ItensForm5W2H } from "@/components/tabela-5w2h";
import { adicionarItensAcao } from "../actions";

/** Adição de vários itens 5W2H de uma vez ao plano da RNC. */
export function ItensForm({ rncId, usuarios }: { rncId: string; usuarios: { id: string; nome: string }[] }) {
  return <ItensForm5W2H acao={adicionarItensAcao} ocultos={{ rncId }} usuarios={usuarios} />;
}
