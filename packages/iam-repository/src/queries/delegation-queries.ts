import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DelegatedAccessRepository,
  ImpersonationSessionRepository,
  ApprovalRequestRepository,
  ApprovalStepRepository,
} from "../repositories/index.js";

export interface DelegationQueriesDeps {
  db: SupabaseClient;
}

export class DelegationQueries {
  private delegatedAccessRepo: DelegatedAccessRepository;
  private impersonationRepo: ImpersonationSessionRepository;
  private approvalRequestRepo: ApprovalRequestRepository;
  private approvalStepRepo: ApprovalStepRepository;

  constructor(deps: DelegationQueriesDeps) {
    this.delegatedAccessRepo = new DelegatedAccessRepository({ db: deps.db });
    this.impersonationRepo = new ImpersonationSessionRepository({ db: deps.db });
    this.approvalRequestRepo = new ApprovalRequestRepository({ db: deps.db });
    this.approvalStepRepo = new ApprovalStepRepository({ db: deps.db });
  }

  async getActiveGrantsForGrantee(tenantId: string, granteeId: string) {
    return this.delegatedAccessRepo.findActiveByGrantee(tenantId, granteeId);
  }

  async getGrantsFromGrantor(tenantId: string, grantorId: string) {
    return this.delegatedAccessRepo.findByGrantor(tenantId, grantorId);
  }

  async getExpiredGrants() {
    return this.delegatedAccessRepo.findExpiredAndActive();
  }

  async getActiveImpersonationSessions(operatorId: string) {
    return this.impersonationRepo.findActiveByOperator(operatorId);
  }

  async getImpersonationHistoryForUser(tenantId: string, userId: string) {
    return this.impersonationRepo.findByImpersonatedUser(tenantId, userId);
  }

  async getOngoingImpersonations() {
    return this.impersonationRepo.findOngoing();
  }

  async getPendingApprovalsForWorkflow(workflowType: string) {
    return this.approvalRequestRepo.findPendingByWorkflow(workflowType);
  }

  async getApprovalsBySubject(subjectType: string, subjectId: string) {
    return this.approvalRequestRepo.findBySubject(subjectType, subjectId);
  }

  async getTenantApprovals(tenantId: string) {
    return this.approvalRequestRepo.findByTenant(tenantId);
  }

  async getExpiredApprovals() {
    return this.approvalRequestRepo.findExpired();
  }

  async getApprovalSteps(approvalRequestId: string) {
    return this.approvalStepRepo.findByApprovalRequestId(approvalRequestId);
  }

  async getPendingApprovalSteps(approvalRequestId: string) {
    return this.approvalStepRepo.findPendingSteps(approvalRequestId);
  }

  async getActorPendingApprovals(actorId: string) {
    return this.approvalStepRepo.findPendingForActor(actorId);
  }
}
