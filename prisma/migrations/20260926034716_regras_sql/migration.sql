-- No máximo uma solicitação de cancelamento PENDENTE por RNC
CREATE UNIQUE INDEX solicitacao_cancelamento_uma_pendente
  ON solicitacao_cancelamento (empresa_id, rnc_id)
  WHERE status = 'PENDENTE';

-- historico_status_rnc é append-only
CREATE OR REPLACE FUNCTION historico_status_rnc_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historico_status_rnc é imutável: % não permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER historico_status_rnc_bloqueia_alteracao
  BEFORE UPDATE OR DELETE ON historico_status_rnc
  FOR EACH ROW EXECUTE FUNCTION historico_status_rnc_imutavel();
