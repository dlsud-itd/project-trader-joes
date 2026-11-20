import { applicantLink } from './applicant-links';
import { KanbanStage } from './applications.models';

describe('applicantLink', () => {
  it('links to every applicant when nothing is set', () => {
    expect(applicantLink()).toEqual({
      path: '/applications',
      queryParams: {},
    });
  });

  it('puts each filter in the query string', () => {
    expect(
      applicantLink({
        postingId: 4,
        stage: KanbanStage.OFFER,
        appliedWithinDays: 7,
        review: 'unrated',
        mine: true,
      }).queryParams,
    ).toEqual({
      posting: '4',
      stage: 'Offer',
      applied: '7',
      review: 'unrated',
      mine: '1',
    });
  });

  it('leaves out "mine" when it is false', () => {
    expect(applicantLink({ mine: false }).queryParams).toEqual({});
  });
});
